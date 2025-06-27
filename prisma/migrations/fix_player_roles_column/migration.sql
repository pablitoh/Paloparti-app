-- Ensure playerRoles column exists in MatchAttendance table
ALTER TABLE "MatchAttendance" ADD COLUMN IF NOT EXISTS "playerRoles" JSONB; 