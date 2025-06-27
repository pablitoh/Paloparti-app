-- Script para agregar campos faltantes en staging
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "teamAColor" TEXT DEFAULT '#3B82F6';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "teamBColor" TEXT DEFAULT '#EF4444';

-- Verificar que los campos se agregaron
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Group' 
AND column_name IN ('teamAColor', 'teamBColor'); 