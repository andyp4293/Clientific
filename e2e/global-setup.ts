import type { FullConfig } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/utils';

const prisma = new PrismaClient();

const ACTIVE_ACCOUNT = {
  email: 'e2e-owner@clientific.app',
  password: 'Clientific123!',
  name: 'Clientific E2E Spa',
  slug: 'clientific-e2e-spa',
  publicId: 'CF-E2E01',
};

const EXPIRED_ACCOUNT = {
  email: 'e2e-expired@clientific.app',
  password: 'Clientific123!',
  name: 'Clientific E2E Trial',
  slug: 'clientific-e2e-trial',
  publicId: 'CF-E2E02',
};

const TRIAL_ACCOUNT = {
  email: 'e2e-trialing@clientific.app',
  password: 'Clientific123!',
  name: 'Clientific E2E Active Trial',
  slug: 'clientific-e2e-active-trial',
  publicId: 'CF-E2E03',
};

async function upsertBusiness(input: {
  email: string;
  password: string;
  name: string;
  slug: string;
  publicId: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
}) {
  const passwordHash = await hashPassword(input.password);

  return prisma.business.upsert({
    where: { email: input.email },
    update: {
      emailVerifiedAt: new Date(),
      passwordHash,
      name: input.name,
      slug: input.slug,
      publicId: input.publicId,
      businessType: 'Salon',
      phone: '5551234567',
      businessEmail: input.email,
      street: '123 Test Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      subscriptionPlan: input.subscriptionPlan,
      subscriptionStatus: input.subscriptionStatus,
      trialEndsAt: input.trialEndsAt,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      resetToken: null,
      resetTokenExpiry: null,
    },
    create: {
      email: input.email,
      emailVerifiedAt: new Date(),
      passwordHash,
      name: input.name,
      slug: input.slug,
      publicId: input.publicId,
      businessType: 'Salon',
      phone: '5551234567',
      businessEmail: input.email,
      street: '123 Test Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      subscriptionPlan: input.subscriptionPlan,
      subscriptionStatus: input.subscriptionStatus,
      trialEndsAt: input.trialEndsAt,
    },
  });
}

export default async function globalSetup(_config: FullConfig) {
  await upsertBusiness({
    ...ACTIVE_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'active',
    trialEndsAt: null,
  });

  await upsertBusiness({
    ...EXPIRED_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() - 60_000),
  });

  await upsertBusiness({
    ...TRIAL_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await prisma.$disconnect();
}

export { ACTIVE_ACCOUNT, EXPIRED_ACCOUNT, TRIAL_ACCOUNT };
