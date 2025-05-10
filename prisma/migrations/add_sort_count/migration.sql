-- Add the sortCount column to the Match table if it doesn't exist
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "sortCount" INTEGER NOT NULL DEFAULT 0; 