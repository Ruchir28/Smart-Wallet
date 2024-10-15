import { PrismaClient } from '@prisma/client';

// Create a single instance of the Prisma client
const prisma = new PrismaClient();

// Create an object with database-related functions
const db: {
  prisma: PrismaClient;
  disconnect: () => Promise<void>;
} = {
  // Expose the Prisma client instance
  prisma,

  // Function to disconnect the Prisma client
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  },
};
// Export the db object
export default db;

// Optionally, export types if needed
export * from '@prisma/client';

