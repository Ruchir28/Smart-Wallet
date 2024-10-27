/*
  Warnings:

  - You are about to drop the column `userId` on the `SmartWallet` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `telegramId` to the `SmartWallet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telegramId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telegramUsername` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SmartWallet" DROP CONSTRAINT "SmartWallet_userId_fkey";

-- AlterTable
ALTER TABLE "SmartWallet" DROP COLUMN "userId",
ADD COLUMN     "telegramId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "telegramId" TEXT NOT NULL,
ADD COLUMN     "telegramUsername" TEXT NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("telegramId");

-- DropTable
DROP TABLE "Token";

-- AddForeignKey
ALTER TABLE "SmartWallet" ADD CONSTRAINT "SmartWallet_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;
