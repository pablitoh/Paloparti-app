/*
  Warnings:

  - A unique constraint covering the columns `[nextMatchId]` on the table `Group` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "nextMatchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Group_nextMatchId_key" ON "Group"("nextMatchId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
