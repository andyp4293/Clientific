import { PrismaClient } from '@prisma/client';
import { sanitizeUserTextFieldsForStorage } from '@/lib/user-text-sanitization';

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Enable connection pooling for better performance
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return query(sanitizeUserTextFieldsForStorage(args));
        },
      },
    },
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Gracefully disconnect on process exit
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
