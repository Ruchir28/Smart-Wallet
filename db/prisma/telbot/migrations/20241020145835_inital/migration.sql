-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "smartWalletId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_smartWalletId_key" ON "User"("smartWalletId");
