import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    const sessionEmail = session?.user?.email?.trim() || null;

    if (!businessId && !sessionEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = businessId
      ? await prisma.business.findUnique({
          where: { id: businessId },
          select: { stripeCustomerId: true, stripeSubscriptionId: true },
        })
      : await prisma.business.findUnique({
          where: { email: sessionEmail as string },
          select: { stripeCustomerId: true, stripeSubscriptionId: true },
        });

    if (!business?.stripeCustomerId) {
      return NextResponse.json({ paymentMethod: null, invoices: [], billingDetails: null });
    }

    // Fetch subscription with expanded default payment method
    let paymentMethod = null;
    if (business.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          business.stripeSubscriptionId,
          { expand: ['default_payment_method', 'customer'] }
        );

        const pm = subscription.default_payment_method as any;
        if (pm?.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
            funding: pm.card.funding,
          };
        }

        // Billing details from customer
        const customer = subscription.customer as any;
        if (!paymentMethod && customer?.invoice_settings?.default_payment_method) {
          const defaultPm = await stripe.paymentMethods.retrieve(
            customer.invoice_settings.default_payment_method as string
          );
          if (defaultPm.card) {
            paymentMethod = {
              brand: defaultPm.card.brand,
              last4: defaultPm.card.last4,
              expMonth: defaultPm.card.exp_month,
              expYear: defaultPm.card.exp_year,
              funding: defaultPm.card.funding,
            };
          }
        }
      } catch {
        // Subscription may not exist yet
      }
    }

    // Fetch recent invoices
    const invoiceList = await stripe.invoices.list({
      customer: business.stripeCustomerId,
      limit: 10,
    });

    const invoices = invoiceList.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amountPaid: inv.amount_paid,
      amountDue: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
      description: inv.lines?.data?.[0]?.description ?? null,
    }));

    return NextResponse.json({ paymentMethod, invoices });
  } catch (error: any) {
    console.error('Billing details error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch billing details' },
      { status: 500 }
    );
  }
}
