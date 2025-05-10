-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "playersA" JSONB,
ADD COLUMN     "playersB" JSONB;

-- RenameForeignKey
ALTER TABLE "MatchPlayer" RENAME CONSTRAINT "TeamARelation" TO "MatchPlayer_matchId_fkey";
