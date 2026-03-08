const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const mirroredOptIns = await prisma.customer.updateMany({
    where: {
      smsConsent: true,
      smsMarketingConsent: false,
    },
    data: {
      smsMarketingConsent: true,
      smsMarketingConsentAt: now,
    },
  });

  const mirroredOptOuts = await prisma.customer.updateMany({
    where: {
      smsConsent: false,
      smsMarketingConsent: true,
    },
    data: {
      smsMarketingConsent: false,
    },
  });

  console.log(
    `Backfill complete. Opt-ins mirrored: ${mirroredOptIns.count}, opt-outs mirrored: ${mirroredOptOuts.count}`
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
