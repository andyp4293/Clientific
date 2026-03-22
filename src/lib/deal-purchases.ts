import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  formatDealPurchaseConfirmationSMS,
  formatPhoneNumber,
  sendSMS,
} from '@/lib/twilio';
import { sendDealPurchaseReceiptEmail } from '@/lib/email';
import type { DealPurchaseTotals } from '@/lib/deal-purchase-pricing';
import { syncDealPurchasePayoutTracking } from '@/lib/deal-payouts';

const DEAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateToken(): string {
  return randomBytes(18).toString('base64url');
}

function generateDealCode(): string {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += DEAL_CODE_ALPHABET[Math.floor(Math.random() * DEAL_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueDealPurchaseToken(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const token = generateToken();
    const existing = await prisma.dealPurchase.findUnique({ where: { token } });
    if (!existing) {
      return token;
    }
  }

  throw new Error('Could not generate a unique deal purchase token');
}

async function generateUniquePurchaseRedemptionCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const code = generateDealCode();
    const [existingPurchase, existingLegacy] = await Promise.all([
      prisma.dealPurchase.findUnique({ where: { redemptionCode: code } }),
      prisma.dealRedemption.findUnique({ where: { code } }),
    ]);

    if (!existingPurchase && !existingLegacy) {
      return code;
    }
  }

  throw new Error('Could not generate a unique deal redemption code');
}

async function resolveCustomerForPurchase({
  businessId,
  customerName,
  customerPhone,
}: {
  businessId: string;
  customerName: string;
  customerPhone: string;
}) {
  const normalizedPhone = formatPhoneNumber(customerPhone);
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: [{ phone: normalizedPhone }, { phone: customerPhone }],
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  if (existingCustomer) {
    return prisma.customer.update({
      where: { id: existingCustomer.id },
      data: {
        name: customerName,
        phone: normalizedPhone,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });
  }

  return prisma.customer.create({
    data: {
      businessId,
      name: customerName,
      phone: normalizedPhone,
      smsConsent: true,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  });
}

export async function createPendingDealPurchase({
  deal,
  customerName,
  customerEmail,
  customerPhone,
  totals,
}: {
  deal: {
    id: string;
    businessId: string;
    expiresAt: Date;
    platformFeePercent: number;
  };
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
  totals: DealPurchaseTotals;
}) {
  const [token, customer] = await Promise.all([
    generateUniqueDealPurchaseToken(),
    resolveCustomerForPurchase({
      businessId: deal.businessId,
      customerName,
      customerPhone,
    }),
  ]);

  const applicationFeeAmount = Math.round(
    totals.totalAmount * (deal.platformFeePercent / 100)
  );
  const businessNetAmount = Math.max(0, totals.totalAmount - applicationFeeAmount);

  return prisma.dealPurchase.create({
    data: {
      businessId: deal.businessId,
      dealId: deal.id,
      customerId: customer.id,
      token,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: formatPhoneNumber(customerPhone),
      subtotalAmount: totals.subtotalAmount,
      discountAmount: totals.discountAmount,
      totalAmount: totals.totalAmount,
      applicationFeeAmount,
      businessNetAmount,
      expiresAt: deal.expiresAt,
      items: {
        create: totals.items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          quantity: item.quantity,
          originalUnitAmount: item.originalUnitAmount,
          discountedUnitAmount: item.discountedUnitAmount,
        })),
      },
    },
    include: {
      items: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });
}

async function resolveReceiptUrl(paymentIntentId: string | null | undefined): Promise<{
  stripeChargeId: string | null;
  stripeReceiptUrl: string | null;
}> {
  if (!paymentIntentId) {
    return { stripeChargeId: null, stripeReceiptUrl: null };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null;

  return {
    stripeChargeId: latestCharge?.id ?? null,
    stripeReceiptUrl: latestCharge?.receipt_url ?? null,
  };
}

/**
 * Called by the payment_intent.succeeded webhook for the new flow where no
 * DealPurchase row is created upfront. All purchase data comes from the
 * PaymentIntent metadata; the DB record is created here for the first time.
 */
export async function createDealPurchaseFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  appBaseUrl: string
) {
  const meta = paymentIntent.metadata ?? {};
  const {
    purchaseToken,
    dealId,
    businessId,
    customerName,
    customerEmail,
    customerPhone,
    selectedServiceIds: selectedServiceIdsJson,
    subtotalAmount,
    discountAmount,
    totalAmount,
    applicationFeeAmount,
    expiresAt,
  } = meta;

  if (!purchaseToken || !dealId || !businessId || !customerName || !customerPhone) {
    console.warn('createDealPurchaseFromPaymentIntent: missing required metadata', meta);
    return null;
  }

  // Idempotency: if a purchase with this token was already created, return it
  const existing = await prisma.dealPurchase.findUnique({ where: { token: purchaseToken } });
  if (existing) {
    return existing;
  }

  // Re-fetch deal + services to build line items
  let selectedIds: string[] = [];
  try {
    selectedIds = JSON.parse(selectedServiceIdsJson ?? '[]');
  } catch {
    selectedIds = [];
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      eligibleServices: {
        where: { active: true },
        select: { id: true, name: true, price: true, active: true },
      },
      business: {
        select: {
          id: true,
          name: true,
          vapiPhoneNumber: true,
          services: {
            where: { active: true },
            select: { id: true, name: true, price: true, active: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!deal) {
    throw new Error(`Deal ${dealId} not found during purchase finalization`);
  }

  const { getSelectableServicesForDeal, resolveSelectedServicesForDeal, calculateDealPurchaseTotals } =
    await import('@/lib/deal-purchase-pricing');

  const selectableServices = getSelectableServicesForDeal(deal, deal.eligibleServices, deal.business.services);
  const resolvedServices = resolveSelectedServicesForDeal(deal, selectableServices, selectedIds);
  const totals = calculateDealPurchaseTotals(deal, resolvedServices);

  const feeAmount = Number(applicationFeeAmount) || Math.round(totals.totalAmount * (deal.platformFeePercent / 100));
  const netAmount = Math.max(0, totals.totalAmount - feeAmount);

  const receiptMeta = await resolveReceiptUrl(paymentIntent.id);
  const redemptionCode = await generateUniquePurchaseRedemptionCode();
  const purchasedAt = new Date();
  const receiptUrl =
    receiptMeta.stripeReceiptUrl ?? `${appBaseUrl}/deal-purchases/${purchaseToken}`;

  const customer = await resolveCustomerForPurchase({ businessId, customerName, customerPhone });

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.dealPurchase.create({
      data: {
        businessId,
        dealId,
        customerId: customer.id,
        token: purchaseToken,
        status: 'paid',
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: formatPhoneNumber(customerPhone),
        subtotalAmount: totals.subtotalAmount,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        applicationFeeAmount: feeAmount,
        businessNetAmount: netAmount,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: receiptMeta.stripeChargeId,
        stripeReceiptUrl: receiptUrl,
        redemptionCode,
        purchasedAt,
        expiresAt: expiresAt ? new Date(expiresAt) : deal.expiresAt,
        items: {
          create: totals.items.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            quantity: item.quantity,
            originalUnitAmount: item.originalUnitAmount,
            discountedUnitAmount: item.discountedUnitAmount,
          })),
        },
      },
      include: {
        deal: { select: { id: true, title: true, businessId: true } },
        business: { select: { name: true, vapiPhoneNumber: true } },
      },
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { redemptionCount: { increment: 1 } },
    });

    return created;
  });

  await syncDealPurchasePayoutTracking({
    purchaseId: purchase.id,
    paymentIntent,
  });

  const smsResult = await sendSMS({
    to: purchase.customerPhone,
    message: formatDealPurchaseConfirmationSMS({
      businessName: purchase.business.name,
      dealTitle: purchase.deal.title,
      redemptionCode: purchase.redemptionCode!,
      receiptUrl,
      customerName: purchase.customerName,
    }),
  });

  await prisma.dealPurchase.update({
    where: { id: purchase.id },
    data: {
      smsConfirmationSentAt: smsResult.success ? new Date() : null,
      smsConfirmationError: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
    },
  });

  if (customerEmail) {
    sendDealPurchaseReceiptEmail({
      to: customerEmail,
      customerName: purchase.customerName,
      businessName: purchase.business.name,
      dealTitle: purchase.deal.title,
      redemptionCode: purchase.redemptionCode!,
      receiptUrl,
      totalAmount: purchase.totalAmount,
      items: totals.items.map((item) => ({
        name: item.serviceName,
        originalAmount: item.originalUnitAmount,
        discountedAmount: item.discountedUnitAmount,
      })),
    }).catch((err) => console.error('Failed to send deal receipt email:', err));
  }

  return purchase;
}

export async function finalizeDealPurchaseFromCheckoutSession(
  session: Stripe.Checkout.Session,
  appBaseUrl: string
) {
  const purchaseId = session.metadata?.dealPurchaseId;
  if (!purchaseId) {
    return null;
  }

  const existingPurchase = await prisma.dealPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          businessId: true,
        },
      },
      business: {
        select: {
          name: true,
          vapiPhoneNumber: true,
        },
      },
    },
  });

  if (!existingPurchase) {
    throw new Error(`Deal purchase ${purchaseId} not found`);
  }

  if (existingPurchase.status === 'paid' && existingPurchase.redemptionCode) {
    return existingPurchase;
  }

  const receiptMeta = await resolveReceiptUrl(
    typeof session.payment_intent === 'string' ? session.payment_intent : null
  );
  const redemptionCode =
    existingPurchase.redemptionCode ?? (await generateUniquePurchaseRedemptionCode());
  const purchasedAt = new Date();
  const customerEmail = session.customer_details?.email ?? existingPurchase.customerEmail ?? null;
  const receiptUrl =
    existingPurchase.stripeReceiptUrl ??
    receiptMeta.stripeReceiptUrl ??
    `${appBaseUrl}/deal-purchases/${existingPurchase.token}`;

  const purchase = await prisma.$transaction(async (tx) => {
    const latest = await tx.dealPurchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        status: true,
        redemptionCode: true,
        dealId: true,
      },
    });

    if (!latest) {
      throw new Error(`Deal purchase ${purchaseId} not found`);
    }

    const shouldIncrementDealCount = latest.status !== 'paid';

    const updated = await tx.dealPurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'paid',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        stripeChargeId: receiptMeta.stripeChargeId,
        stripeReceiptUrl: receiptUrl,
        redemptionCode: latest.redemptionCode ?? redemptionCode,
        purchasedAt,
        customerEmail,
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            businessId: true,
          },
        },
        business: {
          select: {
            name: true,
            vapiPhoneNumber: true,
          },
        },
      },
    });

    if (shouldIncrementDealCount) {
      await tx.deal.update({
        where: { id: latest.dealId },
        data: {
          redemptionCount: { increment: 1 },
        },
      });
    }

    return updated;
  });

  if (typeof session.payment_intent === 'string') {
    await syncDealPurchasePayoutTracking({
      purchaseId: purchase.id,
      paymentIntentId: session.payment_intent,
    });
  }

  const smsResult = await sendSMS({
    to: purchase.customerPhone,
    from: purchase.business.vapiPhoneNumber ?? null,
    message: formatDealPurchaseConfirmationSMS({
      businessName: purchase.business.name,
      dealTitle: purchase.deal.title,
      redemptionCode: purchase.redemptionCode!,
      receiptUrl,
      customerName: purchase.customerName,
    }),
  });

  await prisma.dealPurchase.update({
    where: { id: purchase.id },
    data: {
      smsConfirmationSentAt: smsResult.success ? new Date() : null,
      smsConfirmationError: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
    },
  });

  return purchase;
}

export async function finalizeDealPurchaseFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  appBaseUrl: string
) {
  const purchaseId = paymentIntent.metadata?.dealPurchaseId;
  if (!purchaseId) {
    return null;
  }

  const existingPurchase = await prisma.dealPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          businessId: true,
        },
      },
      business: {
        select: {
          name: true,
          vapiPhoneNumber: true,
        },
      },
    },
  });

  if (!existingPurchase) {
    throw new Error(`Deal purchase ${purchaseId} not found`);
  }

  if (existingPurchase.status === 'paid' && existingPurchase.redemptionCode) {
    return existingPurchase;
  }

  const receiptMeta = await resolveReceiptUrl(paymentIntent.id);
  const redemptionCode =
    existingPurchase.redemptionCode ?? (await generateUniquePurchaseRedemptionCode());
  const purchasedAt = new Date();
  const receiptUrl =
    existingPurchase.stripeReceiptUrl ??
    receiptMeta.stripeReceiptUrl ??
    `${appBaseUrl}/deal-purchases/${existingPurchase.token}`;

  const purchase = await prisma.$transaction(async (tx) => {
    const latest = await tx.dealPurchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        status: true,
        redemptionCode: true,
        dealId: true,
      },
    });

    if (!latest) {
      throw new Error(`Deal purchase ${purchaseId} not found`);
    }

    const shouldIncrementDealCount = latest.status !== 'paid';

    const updated = await tx.dealPurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'paid',
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: receiptMeta.stripeChargeId,
        stripeReceiptUrl: receiptUrl,
        redemptionCode: latest.redemptionCode ?? redemptionCode,
        purchasedAt,
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            businessId: true,
          },
        },
        business: {
          select: {
            name: true,
            vapiPhoneNumber: true,
          },
        },
        items: true,
      },
    });

    if (shouldIncrementDealCount) {
      await tx.deal.update({
        where: { id: latest.dealId },
        data: {
          redemptionCount: { increment: 1 },
        },
      });
    }

    return updated;
  });

  await syncDealPurchasePayoutTracking({
    purchaseId: purchase.id,
    paymentIntent,
  });

  const smsResult = await sendSMS({
    to: purchase.customerPhone,
    from: purchase.business.vapiPhoneNumber ?? null,
    message: formatDealPurchaseConfirmationSMS({
      businessName: purchase.business.name,
      dealTitle: purchase.deal.title,
      redemptionCode: purchase.redemptionCode!,
      receiptUrl,
      customerName: purchase.customerName,
    }),
  });

  await prisma.dealPurchase.update({
    where: { id: purchase.id },
    data: {
      smsConfirmationSentAt: smsResult.success ? new Date() : null,
      smsConfirmationError: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
    },
  });

  if (purchase.customerEmail) {
    sendDealPurchaseReceiptEmail({
      to: purchase.customerEmail,
      customerName: purchase.customerName,
      businessName: purchase.business.name,
      dealTitle: purchase.deal.title,
      redemptionCode: purchase.redemptionCode!,
      receiptUrl,
      totalAmount: purchase.totalAmount,
      items: purchase.items.map((item) => ({
        name: item.serviceName,
        originalAmount: item.originalUnitAmount,
        discountedAmount: item.discountedUnitAmount,
      })),
    }).catch((err) => console.error('Failed to send deal receipt email:', err));
  }

  return purchase;
}
