import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import {
  addBankAccountToConnect,
  ensureBusinessConnectAccount,
  removeBankAccountFromConnect,
  syncBusinessConnectAccount,
} from '@/lib/stripe-connect';

// ── GET — return current bank account for this business ───────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bankAccount = await prisma.businessBankAccount.findUnique({
      where: { businessId },
    });

    if (!bankAccount) {
      return NextResponse.json({ bankAccount: null });
    }

    return NextResponse.json({
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        last4: bankAccount.last4,
        routingNumberLast4: bankAccount.routingNumberLast4,
        accountHolderName: bankAccount.accountHolderName,
        createdAt: bankAccount.createdAt,
      },
    });
  } catch (error: any) {
    console.error('GET /api/stripe/bank-account error:', error);
    return NextResponse.json({ error: 'Failed to load bank account' }, { status: 500 });
  }
}

// ── POST — add / replace bank account ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const routingNumber = typeof body.routingNumber === 'string' ? body.routingNumber.replace(/\D/g, '') : '';
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.replace(/\D/g, '') : '';
    const accountHolderName = typeof body.accountHolderName === 'string' ? body.accountHolderName.trim() : '';

    if (!routingNumber || routingNumber.length !== 9) {
      return NextResponse.json({ error: 'Routing number must be 9 digits' }, { status: 400 });
    }
    if (!accountNumber || accountNumber.length < 4 || accountNumber.length > 17) {
      return NextResponse.json({ error: 'Invalid account number' }, { status: 400 });
    }
    if (!accountHolderName) {
      return NextResponse.json({ error: 'Account holder name is required' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, email: true, name: true, stripeConnectAccountId: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Ensure a Custom Connect account exists (creates one silently if not)
    const appUrl = req.headers.get('origin') ?? 'https://clientific.net';
    const connectAccount = await ensureBusinessConnectAccount(business, appUrl);

    // Remove existing bank account from Stripe if present
    const existing = await prisma.businessBankAccount.findUnique({ where: { businessId } });
    if (existing) {
      try {
        await removeBankAccountFromConnect(connectAccount.id, existing.stripeExternalAccountId);
      } catch {
        // Ignore — external account may have been removed already
      }
    }

    // Add new bank account to Connect account
    const externalAccount = await addBankAccountToConnect(
      connectAccount.id,
      routingNumber,
      accountNumber,
      accountHolderName
    );

    // Sync updated account status (payouts_enabled should now be true)
    const updated = await (await import('@/lib/stripe')).stripe.accounts.retrieve(connectAccount.id);
    await syncBusinessConnectAccount(businessId, updated);

    // Upsert bank account record
    const bankAccount = await prisma.businessBankAccount.upsert({
      where: { businessId },
      create: {
        businessId,
        stripeExternalAccountId: externalAccount.id,
        bankName: externalAccount.bank_name ?? null,
        last4: externalAccount.last4,
        routingNumberLast4: routingNumber.slice(-4),
        accountHolderName,
      },
      update: {
        stripeExternalAccountId: externalAccount.id,
        bankName: externalAccount.bank_name ?? null,
        last4: externalAccount.last4,
        routingNumberLast4: routingNumber.slice(-4),
        accountHolderName,
      },
    });

    return NextResponse.json({
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        last4: bankAccount.last4,
        routingNumberLast4: bankAccount.routingNumberLast4,
        accountHolderName: bankAccount.accountHolderName,
        createdAt: bankAccount.createdAt,
      },
    });
  } catch (error: any) {
    console.error('POST /api/stripe/bank-account error:', error);
    const msg = error?.raw?.message ?? error?.message ?? 'Failed to save bank account';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — remove bank account ──────────────────────────────────────────────

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [business, existing] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { stripeConnectAccountId: true },
      }),
      prisma.businessBankAccount.findUnique({ where: { businessId } }),
    ]);

    if (!existing) {
      return NextResponse.json({ error: 'No bank account on file' }, { status: 404 });
    }

    if (business?.stripeConnectAccountId) {
      try {
        await removeBankAccountFromConnect(
          business.stripeConnectAccountId,
          existing.stripeExternalAccountId
        );
      } catch {
        // Ignore if already removed
      }
    }

    await prisma.businessBankAccount.delete({ where: { businessId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/stripe/bank-account error:', error);
    return NextResponse.json({ error: 'Failed to remove bank account' }, { status: 500 });
  }
}
