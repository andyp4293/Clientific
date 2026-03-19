import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import {
  addBankAccountToConnect,
  ensureBusinessConnectAccount,
  removeBankAccountFromConnect,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

async function getAuthenticatedBusiness() {
  const session = await getServerSession(authOptions);
  const businessId = getSessionBusinessId(session);
  if (!businessId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeConnectAccountId: true,
    },
  });

  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };
  }

  return { business };
}

function serializeBankAccount(bankAccount: {
  id: string;
  bankName: string | null;
  last4: string;
  routingNumberLast4: string;
  accountHolderName: string | null;
  createdAt?: Date;
}) {
  return {
    id: bankAccount.id,
    bankName: bankAccount.bankName,
    last4: bankAccount.last4,
    routingNumberLast4: bankAccount.routingNumberLast4,
    accountHolderName: bankAccount.accountHolderName,
    createdAt: bankAccount.createdAt,
  };
}

export async function GET() {
  try {
    const { business, error } = await getAuthenticatedBusiness();
    if (error) {
      return error;
    }

    if (!business?.stripeConnectAccountId) {
      return NextResponse.json({ bankAccount: null });
    }

    const status = await syncBusinessConnectState(
      business.id,
      business.stripeConnectAccountId
    );

    if (!status.externalAccount) {
      return NextResponse.json({ bankAccount: null });
    }

    const bankAccount = await prisma.businessBankAccount.findUnique({
      where: { businessId: business.id },
    });

    if (!bankAccount) {
      return NextResponse.json({
        bankAccount: {
          id: status.externalAccount.id,
          bankName: status.externalAccount.bankName,
          last4: status.externalAccount.last4,
          routingNumberLast4: status.externalAccount.routingNumberLast4,
          accountHolderName: status.externalAccount.accountHolderName,
          createdAt: null,
        },
      });
    }

    return NextResponse.json({ bankAccount: serializeBankAccount(bankAccount) });
  } catch (error: any) {
    console.error('GET /api/stripe/bank-account error:', error);
    return NextResponse.json({ error: 'Failed to load bank account' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { business, error } = await getAuthenticatedBusiness();
    if (error) {
      return error;
    }

    const body = await req.json().catch(() => ({}));
    const routingNumber =
      typeof body.routingNumber === 'string' ? body.routingNumber.replace(/\D/g, '') : '';
    const accountNumber =
      typeof body.accountNumber === 'string' ? body.accountNumber.replace(/\D/g, '') : '';
    const accountHolderName =
      typeof body.accountHolderName === 'string' ? body.accountHolderName.trim() : '';

    if (!routingNumber || routingNumber.length !== 9) {
      return NextResponse.json({ error: 'Routing number must be 9 digits' }, { status: 400 });
    }
    if (!accountNumber || accountNumber.length < 4 || accountNumber.length > 17) {
      return NextResponse.json({ error: 'Invalid account number' }, { status: 400 });
    }
    if (!accountHolderName) {
      return NextResponse.json({ error: 'Account holder name is required' }, { status: 400 });
    }

    const connectAccount = await ensureBusinessConnectAccount(
      {
        id: business!.id,
        email: business!.email,
        name: business!.name,
        stripeConnectAccountId: business!.stripeConnectAccountId,
      },
      getAppBaseUrlFromRequest(req.url)
    );

    const existingBankAccount = await prisma.businessBankAccount.findUnique({
      where: { businessId: business!.id },
    });

    if (existingBankAccount?.stripeExternalAccountId) {
      await removeBankAccountFromConnect(
        connectAccount.id,
        existingBankAccount.stripeExternalAccountId
      ).catch(() => null);
    }

    await addBankAccountToConnect(
      connectAccount.id,
      routingNumber,
      accountNumber,
      accountHolderName
    );
    const status = await syncBusinessConnectState(business!.id, connectAccount.id);

    if (!status.externalAccount) {
      return NextResponse.json({ error: 'Bank account was added but could not be verified' }, { status: 500 });
    }

    const bankAccount = await prisma.businessBankAccount.findUnique({
      where: { businessId: business!.id },
    });

    if (!bankAccount) {
      return NextResponse.json({
        bankAccount: {
          id: status.externalAccount.id,
          bankName: status.externalAccount.bankName,
          last4: status.externalAccount.last4,
          routingNumberLast4: status.externalAccount.routingNumberLast4,
          accountHolderName: status.externalAccount.accountHolderName,
          createdAt: null,
        },
      });
    }

    return NextResponse.json({ bankAccount: serializeBankAccount(bankAccount) });
  } catch (error: any) {
    console.error('POST /api/stripe/bank-account error:', error);
    return NextResponse.json({ error: 'Failed to save bank account' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { business, error } = await getAuthenticatedBusiness();
    if (error) {
      return error;
    }

    const existing = await prisma.businessBankAccount.findUnique({
      where: { businessId: business!.id },
    });

    if (!existing?.stripeExternalAccountId || !business?.stripeConnectAccountId) {
      return NextResponse.json({ error: 'No bank account on file' }, { status: 404 });
    }

    await removeBankAccountFromConnect(
      business.stripeConnectAccountId,
      existing.stripeExternalAccountId
    );
    await prisma.businessBankAccount.deleteMany({ where: { businessId: business.id } });
    await syncBusinessConnectState(business.id, business.stripeConnectAccountId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/stripe/bank-account error:', error);
    return NextResponse.json({ error: 'Failed to remove bank account' }, { status: 500 });
  }
}
