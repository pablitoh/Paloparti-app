-- Add the missing fields if they don't exist
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "playersA" JSONB;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "playersB" JSONB; 