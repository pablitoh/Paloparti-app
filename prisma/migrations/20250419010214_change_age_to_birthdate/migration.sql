/*
  Warnings:

  - The `lastSortingCriteria` column on the `Group` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `age` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Group_inviteToken_key";

-- Add birthdate column first
ALTER TABLE "User" ADD COLUMN "birthdate" TIMESTAMP(3);

-- Convert age to birthdate for all users
-- This will set birthdate to January 1st of the year that corresponds to their age
UPDATE "User" 
SET "birthdate" = CURRENT_DATE - (CAST("age" AS INTEGER) || ' years')::INTERVAL
WHERE "age" IS NOT NULL;

-- Now drop the age column
ALTER TABLE "User" DROP COLUMN "age";

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "sport" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "recurrenceTime" DROP DEFAULT,
ALTER COLUMN "recurrenceType" DROP DEFAULT,
ALTER COLUMN "requiredPlayers" SET DEFAULT 10,
DROP COLUMN "lastSortingCriteria",
ADD COLUMN     "lastSortingCriteria" JSONB;

-- CreateTable
CREATE TABLE "MatchAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "matchId" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchAttendance_groupId_matchDate_idx" ON "MatchAttendance"("groupId", "matchDate");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAttendance_userId_matchId_key" ON "MatchAttendance"("userId", "matchId");

-- AddForeignKey
ALTER TABLE "MatchAttendance" ADD CONSTRAINT "MatchAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAttendance" ADD CONSTRAINT "MatchAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAttendance" ADD CONSTRAINT "MatchAttendance_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
