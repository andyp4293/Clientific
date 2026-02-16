const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteByEmail() {
  const email = 'andyp4293@gmail.com'; // Change this if needed
  
  try {
    console.log(`🗑️  Deleting business with email: ${email}`);
    
    const result = await prisma.business.delete({
      where: { email: email.toLowerCase() }
    });
    
    console.log(`✅ Deleted business: ${result.name} (${result.email})`);
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.log('ℹ️  No business found with that email');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

deleteByEmail();
