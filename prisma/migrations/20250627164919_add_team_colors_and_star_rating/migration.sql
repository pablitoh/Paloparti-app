/*
  Warnings:

  - You are about to drop the column `playersA` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `playersB` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "teamAColor" TEXT DEFAULT '#3B82F6',
ADD COLUMN     "teamBColor" TEXT DEFAULT '#EF4444';

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "starRating" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "playersA",
DROP COLUMN "playersB";

-- AlterTable
ALTER TABLE "MatchAttendance" ADD COLUMN     "playerRoles" JSONB;
