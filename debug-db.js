const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDatabase() {
  console.log('=== DATABASE STATE DEBUG ===\n');

  // Get businesses
  const businesses = await prisma.business.findMany({
    include: {
      businessHours: true,
      services: true,
      staff: true,
    },
  });

  if (businesses.length === 0) {
    console.log('❌ No businesses found in database!');
    await prisma.$disconnect();
    return;
  }

  for (const business of businesses) {
    console.log(`\n📊 Business: ${business.businessName}`);
    console.log(`   Public ID: ${business.publicId}`);
    console.log(`   Booking enabled: ${business.enableOnlineBooking ? '✅' : '❌'}`);
    
    console.log('\n📅 Business Hours:');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    business.businessHours.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    
    for (const hours of business.businessHours) {
      const dayName = dayNames[hours.dayOfWeek];
      if (hours.isOpen) {
        console.log(`   ${dayName}: ${hours.openTime} - ${hours.closeTime}`);
      } else {
        console.log(`   ${dayName}: CLOSED`);
      }
    }
    
    console.log(`\n💼 Services (${business.services.length}):`);
    if (business.services.length === 0) {
      console.log('   ❌ No services found!');
    } else {
      for (const service of business.services) {
        console.log(`   - ${service.name} (${service.duration} min) - ${service.active ? '✅ Active' : '❌ Inactive'}`);
      }
    }
    
    console.log(`\n👥 Staff (${business.staff.length}):`);
    if (business.staff.length === 0) {
      console.log('   ❌ No staff found!');
    } else {
      for (const staff of business.staff) {
        console.log(`   - ${staff.fullName} (${staff.role || 'No role'}) - ${staff.active ? '✅ Active' : '❌ Inactive'}`);
      }
    }
    
    // Check for appointments
    const appointments = await prisma.appointment.count({
      where: { businessId: business.id },
    });
    console.log(`\n📋 Appointments: ${appointments}`);
  }

  console.log('\n=== END DEBUG ===\n');
  await prisma.$disconnect();
}

debugDatabase().catch(console.error);
