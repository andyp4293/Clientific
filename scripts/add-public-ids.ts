// Script to add publicId to existing businesses
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generatePublicBusinessId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'CF-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

async function main() {
  console.log('Checking for businesses without publicId...');
  
  const businessesWithoutPublicId = await prisma.business.findMany({
    where: {
      publicId: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`Found ${businessesWithoutPublicId.length} businesses without publicId`);

  for (const business of businessesWithoutPublicId) {
    let publicId = generatePublicBusinessId();
    
    // Ensure uniqueness
    let exists = await prisma.business.findUnique({
      where: { publicId },
    });
    
    while (exists) {
      publicId = generatePublicBusinessId();
      exists = await prisma.business.findUnique({
        where: { publicId },
      });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: { publicId },
    });

    console.log(`✓ Updated "${business.name}" with publicId: ${publicId}`);
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
