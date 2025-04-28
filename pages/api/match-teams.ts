import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { matchId, teamAPlayers, teamBPlayers } = req.body;

    if (!matchId) {
      return res.status(400).json({ message: 'ID del partido requerido' });
    }

    if (!Array.isArray(teamAPlayers) || !Array.isArray(teamBPlayers)) {
      return res.status(400).json({
        message: 'Se requieren arrays de jugadores para ambos equipos',
      });
    }

    // Verificar que el partido existe
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            members: {
              where: {
                userId: user.id,
                role: 'ADMIN', // Verificar que el usuario sea admin
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Verificar que el usuario tiene permisos de administrador
    if (match.group.members.length === 0) {
      return res.status(403).json({
        message: 'No tienes permisos de administrador para este grupo',
      });
    }

    // Eliminar jugadores existentes (si hay)
    await prisma.matchPlayer.deleteMany({
      where: { matchId },
    });

    // Registrar jugadores del equipo A
    const teamAPromises = teamAPlayers.map((playerId: string) => {
      return prisma.matchPlayer.create({
        data: {
          matchId,
          userId: playerId,
          isTeamA: true,
        },
      });
    });

    // Registrar jugadores del equipo B
    const teamBPromises = teamBPlayers.map((playerId: string) => {
      return prisma.matchPlayer.create({
        data: {
          matchId,
          userId: playerId,
          isTeamA: false,
        },
      });
    });

    // Ejecutar todas las operaciones
    await Promise.all([...teamAPromises, ...teamBPromises]);

    return res.status(200).json({
      message: 'Jugadores registrados correctamente',
    });
  } catch (error) {
    console.error('Error registrando jugadores:', error);
    return res.status(500).json({
      message: 'Error al registrar los jugadores',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
