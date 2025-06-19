import { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../../../lib/auth';
import {
  createGhostPlayer,
  deleteGhostPlayer,
} from '../../../../lib/ghostPlayerUtils';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const { id: groupId } = req.query;
  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ message: 'ID de grupo inválido' });
  }

  // Verificar que es admin del grupo
  const adminMembership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId: user.id,
      role: 'ADMIN',
    },
  });

  if (!adminMembership) {
    return res
      .status(403)
      .json({ message: 'No tienes permisos de administrador' });
  }

  try {
    switch (req.method) {
      case 'POST':
        // Crear jugador fantasma
        const { name, age } = req.body;

        if (!name || !age) {
          return res.status(400).json({ message: 'Se requiere nombre y edad' });
        }

        // Validar nombre
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: 'El nombre debe ser válido' });
        }

        // Validar edad
        const ageNumber = parseInt(age);
        if (isNaN(ageNumber) || ageNumber < 12 || ageNumber > 100) {
          return res
            .status(400)
            .json({ message: 'La edad debe estar entre 12 y 100 años' });
        }

        const result = await createGhostPlayer(groupId, user.id, {
          name: name.trim(),
          age: ageNumber,
        });

        return res.status(201).json({
          message: 'Jugador fantasma creado exitosamente',
          ghostPlayer: result.ghostUser,
          metadata: result.metadata,
        });

      case 'DELETE':
        // Eliminar jugador fantasma
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ message: 'ID de usuario requerido' });
        }

        await deleteGhostPlayer(userId, groupId);

        return res.status(200).json({
          message: 'Jugador fantasma eliminado exitosamente',
        });

      default:
        return res.status(405).json({ message: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en gestión de jugadores fantasma:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('Request body:', req.body);
    console.error('Request method:', req.method);
    console.error('Group ID:', groupId);

    return res.status(500).json({
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido',
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.stack : undefined,
      }),
    });
  }
}
