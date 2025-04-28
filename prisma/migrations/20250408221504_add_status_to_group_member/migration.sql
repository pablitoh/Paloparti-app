-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "lastSortingCriteria" TEXT,
ADD COLUMN     "teamAName" TEXT DEFAULT 'Equipo A',
ADD COLUMN     "teamBName" TEXT DEFAULT 'Equipo B',
ALTER COLUMN "recurrenceDays" SET DEFAULT ARRAY[]::INTEGER[],
ALTER COLUMN "recurrenceTime" SET DEFAULT '18:00',
ALTER COLUMN "recurrenceType" SET DEFAULT 'NONE',
ALTER COLUMN "requiredPlayers" SET DEFAULT 4;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';
