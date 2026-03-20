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

async function seedCustomersForBusiness(
  businessId: string,
  customers: Array<{
    name: string;
    email: string;
    phone: string;
    segment: string;
    smsConsent: boolean;
    smsOptedOut: boolean;
    points: number;
    totalSpent: number;
    lastVisit: Date | null;
  }>
) {
  await prisma.customer.deleteMany({ where: { businessId } });

  await prisma.customer.createMany({
    data: customers.map((customer) => ({
      businessId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      segment: customer.segment,
      smsConsent: customer.smsConsent,
      smsMarketingConsent: customer.smsConsent,
      smsOptedOut: customer.smsOptedOut,
      points: customer.points,
      totalSpent: customer.totalSpent,
      lastVisit: customer.lastVisit,
    })),
  });
}

export default async function globalSetup(_config: FullConfig) {
  const activeBusiness = await upsertBusiness({
    ...ACTIVE_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'active',
    trialEndsAt: null,
  });

  const expiredBusiness = await upsertBusiness({
    ...EXPIRED_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() - 60_000),
  });

  const trialBusiness = await upsertBusiness({
    ...TRIAL_ACCOUNT,
    subscriptionPlan: 'base',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await seedCustomersForBusiness(activeBusiness.id, [
    {
      name: 'Maya Chen',
      email: 'maya.chen@example.com',
      phone: '+15555550101',
      segment: 'VIP',
      smsConsent: true,
      smsOptedOut: false,
      points: 320,
      totalSpent: 1485,
      lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ]);

  await seedCustomersForBusiness(expiredBusiness.id, [
    {
      name: 'Jordan Hill',
      email: 'jordan.hill@example.com',
      phone: '+15555550102',
      segment: 'AT_RISK',
      smsConsent: true,
      smsOptedOut: true,
      points: 40,
      totalSpent: 95,
      lastVisit: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
  ]);

  await seedCustomersForBusiness(trialBusiness.id, [
    {
      name: 'Ariana Perez',
      email: 'ariana.perez@example.com',
      phone: '+15555550103',
      segment: 'NEW',
      smsConsent: true,
      smsOptedOut: false,
      points: 15,
      totalSpent: 85,
      lastVisit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Nina Brooks',
      email: 'nina.brooks@example.com',
      phone: '+15555550104',
      segment: 'VIP',
      smsConsent: true,
      smsOptedOut: false,
      points: 220,
      totalSpent: 1240,
      lastVisit: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  ]);

  await prisma.$disconnect();
}

export { ACTIVE_ACCOUNT, EXPIRED_ACCOUNT, TRIAL_ACCOUNT };
