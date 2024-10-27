/*
- Wrap the entire migration in a transaction
  Warnings:

  - You are about to drop the column `pinHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `publicKey` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smartWalletId` on the `User` table. All the data in the column will be lost.

*/
-- Step 1: Create the new SmartWallet table
CREATE TABLE "SmartWallet" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pinHash" TEXT,

    CONSTRAINT "SmartWallet_pkey" PRIMARY KEY ("id")
);

-- Step 2: Transfer existing data from User to SmartWallet
INSERT INTO "SmartWallet" ("id", "publicKey", "userId", "createdAt", "updatedAt", "pinHash")
SELECT "smartWalletId", "publicKey", "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "pinHash"
FROM "User"
WHERE "smartWalletId" IS NOT NULL;

-- Step 3: Add foreign key constraint
ALTER TABLE "SmartWallet" ADD CONSTRAINT "SmartWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Drop columns from User table
ALTER TABLE "User" DROP COLUMN "pinHash",
DROP COLUMN "publicKey",
DROP COLUMN "smartWalletId";


-- Step 5: Make non-null constraints after data transfer
ALTER TABLE "SmartWallet" ALTER COLUMN "publicKey" SET NOT NULL,
                          ALTER COLUMN "pinHash" SET NOT NULL;
