import { prisma } from '@/lib/prisma';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type BusinessAccessFields = {
  id: string;
  name: string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  subscriptionCurrentPeriodEnd: Date | null;
};

export type BusinessAccessExtensionResult =
  | {
      status: 'updated';
      businessId: string;
      before: BusinessAccessFields;
      after: BusinessAccessFields;
      extendedUntil: Date;
    }
  | {
      status: 'not_found' | 'ambiguous';
      matches: Array<Pick<BusinessAccessFields, 'id' | 'name'>>;
    };

export function calculateExtendedAccessDate(input: {
  trialEndsAt?: Date | null;
  subscriptionCurrentPeriodEnd?: Date | null;
  now?: Date;
  days: number;
}) {
  if (!Number.isFinite(input.days) || input.days <= 0) {
    throw new Error('Extension days must be a positive number.');
  }

  const now = input.now ?? new Date();
  const candidates = [
    now,
    input.trialEndsAt ?? null,
    input.subscriptionCurrentPeriodEnd ?? null,
  ].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  const base = candidates.reduce((latest, value) =>
    value.getTime() > latest.getTime() ? value : latest,
  );

  return new Date(base.getTime() + input.days * DAY_IN_MS);
}

export function getAccessExtensionUpdate(
  business: Pick<BusinessAccessFields, 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'>,
  extendedUntil: Date,
) {
  const status = business.subscriptionStatus?.trim().toLowerCase();

  if (status === 'active' || status === 'grace_period') {
    return { subscriptionCurrentPeriodEnd: extendedUntil };
  }

  return {
    subscriptionStatus: 'trialing',
    trialEndsAt: extendedUntil,
  };
}

export async function extendBusinessAccessByExactName(
  name: string,
  days: number,
  now = new Date(),
): Promise<BusinessAccessExtensionResult> {
  const matches = await prisma.business.findMany({
    where: { name },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  if (matches.length !== 1) {
    return {
      status: matches.length === 0 ? 'not_found' : 'ambiguous',
      matches: matches.map(({ id, name: matchName }) => ({ id, name: matchName })),
    };
  }

  const before = matches[0];
  const extendedUntil = calculateExtendedAccessDate({
    trialEndsAt: before.trialEndsAt,
    subscriptionCurrentPeriodEnd: before.subscriptionCurrentPeriodEnd,
    days,
    now,
  });
  const after = await prisma.business.update({
    where: { id: before.id },
    data: getAccessExtensionUpdate(before, extendedUntil),
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  return {
    status: 'updated',
    businessId: before.id,
    before,
    after,
    extendedUntil,
  };
}
