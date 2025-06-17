import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';
import {
  normalizeTbdPlayers,
  findTbdPlayer,
  serializeTbdPlayers,
  type TbdPlayer,
  type TbdPlayersStructure,
} from '../../../../utils/tbdPlayersUtils';

// Define types for players
interface Player {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { id } = req.query;
    const { player1Id, player2Id, player1IsTeamA, player2IsTeamA } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de partido inválido' });
    }

    if (!player1Id || !player2Id) {
      return res.status(400).json({
        message: 'Se requieren los IDs de ambos jugadores',
      });
    }

    if (player1IsTeamA === player2IsTeamA) {
      return res.status(400).json({
        message: 'Los jugadores deben estar en equipos diferentes',
      });
    }

    // Obtener el partido
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: true,
          },
        },
        matchPlayers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Verificar que el usuario es admin del grupo
    const isAdmin = match.group.members.some(
      (member: (typeof match.group.members)[0]) =>
        member.userId === user.id && member.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'No tienes permisos de administrador para este grupo',
      });
    }

    // Procesar el objeto tbdPlayers usando la utilidad normalizada
    const tbdPlayers = normalizeTbdPlayers(match.tbdPlayers);

    // Encontrar los jugadores en los equipos
    const findPlayer = (playerId: string, isTeamA: boolean) => {
      // Buscar en jugadores reales
      const realPlayer = match.matchPlayers.find(
        (mp: any) => mp.userId === playerId && mp.isTeamA === isTeamA
      );

      if (realPlayer) {
        return {
          id: realPlayer.userId,
          name: realPlayer.user.name,
          avatar: realPlayer.user.image,
          isTeamA: realPlayer.isTeamA,
          playerType: 'REAL',
        };
      }

      // Buscar en jugadores TBD usando la utilidad
      const tbdPlayer = findTbdPlayer(tbdPlayers, playerId, isTeamA);

      if (tbdPlayer) {
        return {
          ...tbdPlayer,
          playerType: 'TBD',
        };
      }

      return null;
    };

    const player1 = findPlayer(player1Id, player1IsTeamA);
    const player2 = findPlayer(player2Id, player2IsTeamA);

    if (!player1 || !player2) {
      return res.status(404).json({
        message: 'Uno o ambos jugadores no fueron encontrados',
      });
    }

    // Realizar el intercambio
    const swapPromises = [];

    // Si player1 es real, actualizar su equipo
    if (player1.playerType === 'REAL') {
      swapPromises.push(
        prisma.matchPlayer.updateMany({
          where: {
            matchId: id,
            userId: player1Id,
          },
          data: {
            isTeamA: !player1IsTeamA,
          },
        })
      );
    }

    // Si player2 es real, actualizar su equipo
    if (player2.playerType === 'REAL') {
      swapPromises.push(
        prisma.matchPlayer.updateMany({
          where: {
            matchId: id,
            userId: player2Id,
          },
          data: {
            isTeamA: !player2IsTeamA,
          },
        })
      );
    }

    // Ejecutar actualizaciones de jugadores reales
    await Promise.all(swapPromises);

    // Actualizar TBD players si alguno es TBD
    if (player1.playerType === 'TBD' || player2.playerType === 'TBD') {
      const updatedTbdPlayers = { ...tbdPlayers };

      // Intercambiar player1 si es TBD
      if (player1.playerType === 'TBD') {
        // Remover de equipo original
        const originalTeam = player1IsTeamA ? 'teamA' : 'teamB';
        const targetTeam = player1IsTeamA ? 'teamB' : 'teamA';

        updatedTbdPlayers[originalTeam] = updatedTbdPlayers[
          originalTeam
        ].filter((p: TbdPlayer) => p.id !== player1Id);

        // Agregar al equipo opuesto con nombre actualizado
        const newTeamIndex = updatedTbdPlayers[targetTeam].length;
        const newTeam = !player1IsTeamA ? 'A' : 'B';
        updatedTbdPlayers[targetTeam].push({
          ...player1,
          isTeamA: !player1IsTeamA,
          name: `Fantasma ${newTeam}${newTeamIndex + 1}`,
        });
      }

      // Intercambiar player2 si es TBD
      if (player2.playerType === 'TBD') {
        // Remover de equipo original
        const originalTeam = player2IsTeamA ? 'teamA' : 'teamB';
        const targetTeam = player2IsTeamA ? 'teamB' : 'teamA';

        updatedTbdPlayers[originalTeam] = updatedTbdPlayers[
          originalTeam
        ].filter((p: TbdPlayer) => p.id !== player2Id);

        // Agregar al equipo opuesto con nombre actualizado
        const newTeamIndex = updatedTbdPlayers[targetTeam].length;
        const newTeam = !player2IsTeamA ? 'A' : 'B';
        updatedTbdPlayers[targetTeam].push({
          ...player2,
          isTeamA: !player2IsTeamA,
          name: `Fantasma ${newTeam}${newTeamIndex + 1}`,
        });
      }

      // Renumerar todos los TBD players para mantener consistencia
      updatedTbdPlayers.teamA = updatedTbdPlayers.teamA.map(
        (player, index) => ({
          ...player,
          name: `Fantasma A${index + 1}`,
        })
      );

      updatedTbdPlayers.teamB = updatedTbdPlayers.teamB.map(
        (player, index) => ({
          ...player,
          name: `Fantasma B${index + 1}`,
        })
      );

      // Actualizar TBD players en la base de datos usando la utilidad de serialización
      await prisma.match.update({
        where: { id },
        data: {
          tbdPlayers: serializeTbdPlayers(updatedTbdPlayers) as unknown as any,
        },
      });
    }

    // Registrar la acción en el log
    await logGroupEvent(match.groupId, user.id, LogAction.PLAYER_SWAPPED, {
      matchId: id,
      player1: {
        id: player1Id,
        name: player1.name,
        type: player1.playerType,
        originalTeam: player1IsTeamA ? 'A' : 'B',
        newTeam: player1IsTeamA ? 'B' : 'A',
      },
      player2: {
        id: player2Id,
        name: player2.name,
        type: player2.playerType,
        originalTeam: player2IsTeamA ? 'A' : 'B',
        newTeam: player2IsTeamA ? 'B' : 'A',
      },
    });

    return res.status(200).json({
      message: 'Jugadores intercambiados correctamente',
      swappedPlayers: {
        player1: {
          ...player1,
          isTeamA: !player1IsTeamA,
        },
        player2: {
          ...player2,
          isTeamA: !player2IsTeamA,
        },
      },
    });
  } catch (error) {
    console.error('Error al intercambiar jugadores:', error);
    return res.status(500).json({ message: 'Error al intercambiar jugadores' });
  }
}
