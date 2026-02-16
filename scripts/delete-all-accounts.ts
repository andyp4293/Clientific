import { prisma } from '../src/lib/prisma';

async function deleteAllAccounts() {
  try {
    console.log('🗑️  Deleting all accounts...');
    
    const deletedCount = await prisma.business.deleteMany({});
    
    console.log(`✅ Deleted ${deletedCount.count} business account(s)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting accounts:', error);
    process.exit(1);
  }
}

deleteAllAccounts();
