/*
  Warnings:

  - You are about to drop the column `playersA` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `playersB` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN "playersA",
DROP COLUMN "playersB";
