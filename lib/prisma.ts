import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create new PrismaClient instance
const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Add retry logic for connection pooling issues
export const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        try {
          return await query(args);
        } catch (error: any) {
          // Handle the specific "prepared statement already exists" error
          if (
            error.message?.includes('prepared statement') &&
            error.message?.includes('already exists')
          ) {
            console.error(
              'Connection pool error occurred, retrying operation...'
            );
            // Wait a small amount of time and retry once
            await new Promise((resolve) => setTimeout(resolve, 50));
            return await query(args);
          }
          throw error;
        }
      },
    },
  },
});

// For development environment, store in global to prevent multiple instances
if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prismaClient;
