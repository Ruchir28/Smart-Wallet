import { PrismaClient } from '@prisma/client';
import prisma from '../prisma';
declare const db: {
    prisma: PrismaClient;
    disconnect: () => Promise<void>;
};
export default db;
export * from '@prisma/client';
