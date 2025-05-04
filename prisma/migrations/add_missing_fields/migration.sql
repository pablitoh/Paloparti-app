-- Add missing columns to Match table
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "tbdPlayers" JSONB;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "playersA" JSONB;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "playersB" JSONB; 