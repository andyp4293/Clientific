// Set business hours to open 7 days a week for testing
import { prisma } from '../src/lib/prisma';

async function openAllDays() {
  try {
    console.log('🕐 Opening business for all 7 days...');
    
    // Get all businesses
    const businesses = await prisma.business.findMany({
      include: {
        businessHours: true,
      },
    });

    console.log(`Found ${businesses.length} businesses`);

    for (const business of businesses) {
      console.log(`\nUpdating ${business.name}...`);

      // Create hours open 7 days a week (9 AM - 5 PM)
      const allDaysOpen: any = {};
      for (let day = 0; day <= 6; day++) {
        allDaysOpen[day.toString()] = {
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00',
        };
      }

      if (business.businessHours.length > 0) {
        // Update existing
        await prisma.businessHours.update({
          where: { id: business.businessHours[0].id },
          data: {
            hours: allDaysOpen,
          },
        });
        console.log(`✅ Updated ${business.name} - Now open 7 days, 9 AM - 5 PM`);
      } else {
        // Create new
        await prisma.businessHours.create({
          data: {
            businessId: business.id,
            hours: allDaysOpen,
          },
        });
        console.log(`✅ Created hours for ${business.name} - Now open 7 days, 9 AM - 5 PM`);
      }
    }

    console.log('\n🎉 All businesses are now open 7 days a week!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

openAllDays();
