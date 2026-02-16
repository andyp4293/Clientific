// Migration script to convert BusinessHours from 7 rows to 1 JSON row per business
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateBusinessHours() {
  console.log('🔄 Starting BusinessHours migration...\n');

  // Get all businesses with their current business hours
  const businesses = await prisma.business.findMany({
    include: {
      businessHours: {
        orderBy: { dayOfWeek: 'asc' }
      }
    }
  });

  console.log(`📊 Found ${businesses.length} businesses to migrate\n`);

  for (const business of businesses) {
    console.log(`Processing: ${business.name}`);
    
    // Convert 7 rows to JSON structure
    const hoursJson: any = {};
    
    for (let day = 0; day <= 6; day++) {
      const dayHours = business.businessHours.find(h => h.dayOfWeek === day);
      if (dayHours) {
        hoursJson[day] = {
          isOpen: dayHours.isOpen,
          ...(dayHours.isOpen && dayHours.openTime && dayHours.closeTime && {
            openTime: dayHours.openTime,
            closeTime: dayHours.closeTime
          })
        };
      } else {
        // Default to closed if no hours found for this day
        hoursJson[day] = { isOpen: false };
      }
    }

    console.log(`  - Converting ${business.businessHours.length} rows to JSON`);
    console.log(`  - JSON structure:`, JSON.stringify(hoursJson, null, 2));

    // Store the old hours IDs for deletion
    const oldHoursIds = business.businessHours.map(h => h.id);

    // Create new single-row record
    await prisma.businessHours.create({
      data: {
        businessId: business.id,
        hours: hoursJson
      }
    });

    console.log(`  ✅ Created new JSON record\n`);
  }

  console.log('✅ Migration complete!');
  console.log(`📊 Reduced from ${businesses.reduce((sum, b) => sum + b.businessHours.length, 0)} rows to ${businesses.length} rows`);
}

migrateBusinessHours()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
