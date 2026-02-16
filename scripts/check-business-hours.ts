import { prisma } from '../src/lib/prisma';

async function checkBusinessHours() {
  try {
    console.log('📋 Checking business hours in database...\n');
    
    const businesses = await prisma.business.findMany({
      include: {
        businessHours: true,
      },
    });

    for (const business of businesses) {
      console.log(`\n🏢 Business: ${business.name} (${business.publicId})`);
      console.log(`   Slug: ${business.slug}`);
      console.log(`   Online Booking: ${business.enableOnlineBooking ? '✅' : '❌'}`);
      
      if (!business.businessHours || business.businessHours.length === 0) {
        console.log('   ⚠️  NO BUSINESS HOURS SET!');
        continue;
      }

      const hours = business.businessHours[0].hours as any;
      console.log('\n   Business Hours:');
      
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (let i = 0; i < 7; i++) {
        const dayHours = hours[i.toString()];
        if (dayHours && dayHours.isOpen) {
          console.log(`   ${days[i]}: ${dayHours.openTime} - ${dayHours.closeTime} ✅`);
        } else {
          console.log(`   ${days[i]}: Closed ❌`);
        }
      }
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkBusinessHours();
