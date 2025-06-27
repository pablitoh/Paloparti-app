/*
  Warnings:

  - You are about to drop the column `playersA` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `playersB` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN IF EXISTS "playersA",
DROP COLUMN IF EXISTS "playersB";

-- CreateTable
CREATE TABLE "GroupLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupLog_groupId_idx" ON "GroupLog"("groupId");

-- CreateIndex
CREATE INDEX "GroupLog_userId_idx" ON "GroupLog"("userId");

-- AddForeignKey
ALTER TABLE "GroupLog" ADD CONSTRAINT "GroupLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupLog" ADD CONSTRAINT "GroupLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
