import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

// Esta comprobación asegura que el código solo se ejecute en el servidor
// y no en el navegador
const isServer = typeof window === 'undefined';

let prisma: any;

// Solo creamos la instancia de PrismaClient si estamos en el servidor
if (isServer) {
  const globalForPrisma = global as unknown as {
    prisma: PrismaClient | undefined;
  };

  // Create singleton PrismaClient for better connection handling
  function createPrismaClient() {
    // Create Prisma client without type issues
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });

    // Add retry logic for connection pooling issues
    const clientWithRetry = client.$extends({
      query: {
        $allModels: {
          async $allOperations({ operation, model, args, query }) {
            // Maximum number of retries
            const MAX_RETRIES = 3;
            let lastError;

            // Try multiple times with backoff
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                return await query(args);
              } catch (error: any) {
                lastError = error;

                // Check for connection pool errors related to prepared statements
                if (
                  error.message?.includes('prepared statement') &&
                  error.message?.includes('already exists')
                ) {
                  console.error(
                    `Connection pool error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
                  );

                  // Exponential backoff with jitter
                  const delay =
                    Math.min(100 * Math.pow(2, attempt - 1), 1000) +
                    Math.floor(Math.random() * 100);
                  await new Promise((resolve) => setTimeout(resolve, delay));

                  // Continue to next retry
                  continue;
                }

                // For other errors, throw immediately
                throw error;
              }
            }

            // If we've exhausted all retries
            throw lastError;
          },
        },
      },
    });

    return clientWithRetry;
  }

  // Use existing instance if available (development) or create new one
  prisma = globalForPrisma.prisma ?? createPrismaClient();

  // If not in production, attach to global for connection reuse
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma as unknown as PrismaClient;
  }
}

export { prisma };
