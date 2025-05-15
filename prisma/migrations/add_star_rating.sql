-- Añadir la columna starRating a la tabla GroupMember con valor por defecto 3
ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS "starRating" INTEGER NOT NULL DEFAULT 3;

-- Actualizar los miembros existentes con valores aleatorios entre 1 y 5
UPDATE "GroupMember" 
SET "starRating" = floor(random() * 5) + 1
WHERE "starRating" = 3; 