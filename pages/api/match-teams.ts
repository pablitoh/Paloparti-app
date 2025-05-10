import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../lib/prisma';
import { logGroupEvent } from '../../utils/serverLogEvents';
import { LogAction } from '../../utils/logTypes';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const session = await getSession({ req });
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const currentUserId = session.user.id;

  // Obtener el método y params
  const { method } = req;

  // Manejar reemplazo de jugador TBD por un usuario real
  if (method === 'POST' && req.body.action === 'replaceTbdPlayer') {
    const { tbdPlayerId, userId, matchId, isTeamA } = req.body;

    if (!tbdPlayerId || !userId || !matchId) {
      return res
        .status(400)
        .json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    try {
      // Obtener información del partido y grupo para validación
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          groupId: true,
          tbdPlayers: true,
          group: {
            select: {
              members: {
                where: {
                  userId: currentUserId,
                  role: 'ADMIN',
                },
              },
            },
          },
        },
      });

      if (!match) {
        return res
          .status(404)
          .json({ success: false, message: 'Partido no encontrado' });
      }

      if (match.group.members.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos de administrador para este grupo',
        });
      }

      // Verificar que el jugador TBD existe en el partido
      const tbdPlayers = match.tbdPlayers as any;
      if (!tbdPlayers) {
        return res.status(404).json({
          success: false,
          message: 'No hay jugadores TBD en este partido',
        });
      }

      // Buscar el jugador TBD
      const tbdPlayersArray = [
        ...(tbdPlayers.teamA || []),
        ...(tbdPlayers.teamB || []),
      ];
      const tbdPlayer = tbdPlayersArray.find((p) => p.id === tbdPlayerId);

      if (!tbdPlayer) {
        return res.status(404).json({
          success: false,
          message: 'Jugador TBD no encontrado',
        });
      }

      // Obtener información del usuario real
      const userToReplace = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          image: true,
        },
      });

      if (!userToReplace) {
        return res
          .status(404)
          .json({ success: false, message: 'Usuario no encontrado' });
      }

      // Eliminar el jugador TBD del arreglo correspondiente
      if (isTeamA) {
        tbdPlayers.teamA = tbdPlayers.teamA.filter(
          (p: any) => p.id !== tbdPlayerId
        );
      } else {
        tbdPlayers.teamB = tbdPlayers.teamB.filter(
          (p: any) => p.id !== tbdPlayerId
        );
      }

      // Actualizar el partido con el nuevo arreglo de TBD
      await prisma.match.update({
        where: { id: matchId },
        data: {
          tbdPlayers,
        },
      });

      // Crear el registro de MatchPlayer para el usuario real
      await prisma.matchPlayer.create({
        data: {
          userId: userId,
          matchId: matchId,
          isTeamA: isTeamA,
        },
      });

      // Crear asistencia confirmada para el usuario
      await prisma.matchAttendance.upsert({
        where: {
          userId_matchId: {
            userId: userId,
            matchId: matchId,
          },
        },
        update: {
          status: 'CONFIRMED',
        },
        create: {
          userId: userId,
          matchId: matchId,
          groupId: match.groupId,
          matchDate: new Date(), // Esto debería ser la fecha real del partido
          status: 'CONFIRMED',
        },
      });

      // Registrar la acción en el log
      await logGroupEvent(
        match.groupId,
        currentUserId,
        LogAction.PLAYER_REPLACED,
        {
          matchId,
          tbdPlayerId,
          tbdPlayerName: tbdPlayer.name,
          newPlayerId: userId,
          newPlayerName: userToReplace.name,
          isTeamA,
          oldPlayer: {
            id: tbdPlayerId,
            name: tbdPlayer.name,
          },
          newPlayer: {
            id: userId,
            name: userToReplace.name,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Jugador reemplazado exitosamente',
        data: {
          tbdPlayerId,
          userId,
          matchId,
          isTeamA,
          user: userToReplace,
        },
      });
    } catch (error) {
      console.error('Error al reemplazar jugador:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al reemplazar jugador',
      });
    }
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  return res.status(400).json({ message: 'Acción no soportada' });
}
