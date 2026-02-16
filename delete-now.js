const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllBusinesses() {
  try {
    console.log('🗑️  Deleting all businesses...');
    
    const result = await prisma.business.deleteMany({});
    
    console.log(`✅ Deleted ${result.count} business(es)`);
    console.log('✅ Database is now empty!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllBusinesses();
