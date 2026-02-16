import { prisma } from '../src/lib/prisma';

async function truncateAllTables() {
  try {
    console.log('🗑️  Truncating all tables...');
    
    // Delete in order to respect foreign key constraints
    await prisma.appointment.deleteMany({});
    console.log('✅ Deleted all appointments');
    
    await prisma.customer.deleteMany({});
    console.log('✅ Deleted all customers');
    
    await prisma.service.deleteMany({});
    console.log('✅ Deleted all services');
    
    await prisma.staff.deleteMany({});
    console.log('✅ Deleted all staff');
    
    await prisma.businessHours.deleteMany({});
    console.log('✅ Deleted all business hours');
    
    await prisma.checkIn.deleteMany({});
    console.log('✅ Deleted all check-ins');
    
    await prisma.review.deleteMany({});
    console.log('✅ Deleted all reviews');
    
    await prisma.reward.deleteMany({});
    console.log('✅ Deleted all rewards');
    
    await prisma.campaign.deleteMany({});
    console.log('✅ Deleted all campaigns');
    
    await prisma.subscription.deleteMany({});
    console.log('✅ Deleted all subscriptions');
    
    await prisma.business.deleteMany({});
    console.log('✅ Deleted all businesses');
    
    console.log('🎉 All data deleted! Database is now empty.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error truncating tables:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

truncateAllTables();
