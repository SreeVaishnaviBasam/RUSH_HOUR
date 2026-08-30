import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const client = new PrismaClient({
      log: ['error', 'warn'],
    });

    // Enable WAL mode for SQLite
    client.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
      .then((res) => {
        console.log(`[Database] WAL mode enabled. Result:`, res);
      })
      .catch((err) => {
        console.error(`[Database] Failed to enable WAL mode:`, err);
      });

    return client;
  })();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
