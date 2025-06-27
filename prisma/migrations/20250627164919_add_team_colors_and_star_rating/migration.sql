/*
  Warnings:

  - You are about to drop the column `playersA` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `playersB` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "teamAColor" TEXT DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS "teamBColor" TEXT DEFAULT '#EF4444';

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS "starRating" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Match" DROP COLUMN IF EXISTS "playersA",
DROP COLUMN IF EXISTS "playersB";

-- AlterTable
ALTER TABLE "MatchAttendance" ADD COLUMN IF NOT EXISTS "playerRoles" JSONB;
