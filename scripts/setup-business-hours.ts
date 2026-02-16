import { prisma } from '../src/lib/prisma';

async function setupBusinessHours() {
  try {
    console.log('🕐 Setting up business hours...\n');
    
    const businesses = await prisma.business.findMany();

    for (const business of businesses) {
      console.log(`Setting up hours for: ${business.name}`);
      
      // Default business hours: Mon-Fri 9AM-5PM, Sat 10AM-3PM, Sun closed
      const defaultHours = {
        '0': { isOpen: false, openTime: null, closeTime: null }, // Sunday
        '1': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
        '2': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
        '3': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Wednesday
        '4': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Thursday
        '5': { isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Friday
        '6': { isOpen: false, openTime: null, closeTime: null }, // Saturday
      };

      await prisma.businessHours.upsert({
        where: { businessId: business.id },
        create: {
          businessId: business.id,
          hours: defaultHours,
        },
        update: {
          hours: defaultHours,
        },
      });

      console.log('✅ Business hours created');
    }

    console.log('\n🎉 All business hours set up!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupBusinessHours();
