import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Ejecutando SQL para agregar campos faltantes...');

    // Ejecutar SQL directo para agregar los campos faltantes
    await prisma.$executeRaw`
      ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "teamAColor" TEXT DEFAULT '#3B82F6';
    `;

    await prisma.$executeRaw`
      ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "teamBColor" TEXT DEFAULT '#EF4444';
    `;

    console.log('Campos agregados exitosamente');

    // Verificar que los campos se agregaron correctamente
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Group' 
      AND column_name IN ('teamAColor', 'teamBColor');
    `;

    console.log('Resultado de verificación:', result);

    return res.status(200).json({
      message: 'Database fixed successfully',
      result,
    });
  } catch (error) {
    console.error('Error fixing database:', error);
    return res.status(500).json({
      message: 'Error fixing database',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await prisma.$disconnect();
  }
}
