import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { Prisma } from '@prisma/client';

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
}

interface TbdPlayersStructure {
  teamA: TbdPlayer[];
  teamB: TbdPlayer[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log request info for debugging
  console.log(
    `[TBD Players API] Received ${req.method} request for match ID: ${req.query.id}`
  );
  console.log(`[TBD Players API] URL: ${req.url}`);

  // Add cache control headers to prevent caching
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Check for valid methods
  if (req.method !== 'POST' && req.method !== 'GET') {
    console.log(`[TBD Players API] Method not allowed: ${req.method}`);
    return res.status(405).json({
      message: 'Method not allowed. Only GET and POST are supported.',
    });
  }

  try {
    const { id: matchId } = req.query;

    if (!matchId || typeof matchId !== 'string') {
      console.log(`[TBD Players API] Invalid match ID: ${matchId}`);
      return res.status(400).json({ message: 'Match ID is required' });
    }

    // Console.log for debugging
    console.log(
      `[TBD Players API] Processing ${req.method} request for match: ${matchId}`
    );

    // Obtener el usuario actual
    const user = await getCurrentUser(req);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Obtener el partido
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Verificar permisos
    const isGroupMember = match.group.members.some(
      (member: (typeof match.group.members)[0]) => member.userId === user.id
    );

    if (!isGroupMember) {
      return res.status(403).json({
        message: 'You are not authorized to access this match',
      });
    }

    // Si es una solicitud GET, simplemente devuelve los TBD players actuales
    if (req.method === 'GET') {
      let existingTbdPlayers: TbdPlayersStructure = { teamA: [], teamB: [] };

      if (match.tbdPlayers) {
        try {
          const tbdData =
            typeof match.tbdPlayers === 'string'
              ? JSON.parse(match.tbdPlayers)
              : match.tbdPlayers;

          // Handle both array and teamA/teamB structure formats
          if (Array.isArray(tbdData)) {
            // If it's an array, separate by team
            existingTbdPlayers = {
              teamA: tbdData
                .filter((p: TbdPlayer) => p.isTeamA)
                .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
              teamB: tbdData
                .filter((p: TbdPlayer) => !p.isTeamA)
                .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
            };
          } else if (tbdData.teamA || tbdData.teamB) {
            // If it already has teamA/teamB structure
            existingTbdPlayers = {
              teamA: Array.isArray(tbdData.teamA)
                ? tbdData.teamA.map((p: TbdPlayer) => ({
                    ...p,
                    playerType: 'TBD',
                  }))
                : [],
              teamB: Array.isArray(tbdData.teamB)
                ? tbdData.teamB.map((p: TbdPlayer) => ({
                    ...p,
                    playerType: 'TBD',
                  }))
                : [],
            };
          }
        } catch (error) {
          console.error('Error parsing existing tbdPlayers:', error);
        }
      }

      console.log('[TBD Players API] Sending GET response:', {
        playerCount: [...existingTbdPlayers.teamA, ...existingTbdPlayers.teamB]
          .length,
      });

      return res.status(200).json({
        tbdPlayers: [...existingTbdPlayers.teamA, ...existingTbdPlayers.teamB],
      });
    }

    // Para solicitudes POST - Verificar que el usuario es admin del grupo
    const isAdmin = match.group.members.some(
      (member: (typeof match.group.members)[0]) =>
        member.userId === user.id && member.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'No tienes permisos para modificar este partido',
      });
    }

    const { tbdPlayers } = req.body;

    // Validar los jugadores TBD (permitimos tanto array como objeto con estructura teamA/teamB)
    let validatedTbdPlayers: TbdPlayer[] = [];

    if (Array.isArray(tbdPlayers)) {
      // Si es un array, lo procesamos directamente
      if (tbdPlayers.length === 0) {
        return res.status(400).json({
          message: 'Se requiere un array válido de jugadores TBD',
        });
      }
      validatedTbdPlayers = tbdPlayers;
    } else if (typeof tbdPlayers === 'object' && tbdPlayers !== null) {
      // Si es un objeto con estructura teamA/teamB, lo convertimos a array
      const teamAPlayers = Array.isArray(tbdPlayers.teamA)
        ? tbdPlayers.teamA
        : [];
      const teamBPlayers = Array.isArray(tbdPlayers.teamB)
        ? tbdPlayers.teamB
        : [];

      if (teamAPlayers.length === 0 && teamBPlayers.length === 0) {
        return res.status(400).json({
          message: 'Se requiere al menos un jugador TBD en teamA o teamB',
        });
      }

      validatedTbdPlayers = [
        ...teamAPlayers.map((p: any) => ({ ...p, isTeamA: true })),
        ...teamBPlayers.map((p: any) => ({ ...p, isTeamA: false })),
      ];
    } else {
      return res.status(400).json({
        message:
          'Formato de jugadores TBD inválido. Debe ser un array o un objeto con propiedades teamA y teamB',
      });
    }

    // Procesar los TBD players
    const parsedTbdPlayers = validatedTbdPlayers.map((player: TbdPlayer) => ({
      id:
        player.id ||
        `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: player.name || `TBD ${Math.floor(Math.random() * 100)}`,
      isTeamA: !!player.isTeamA,
      playerType: 'TBD', // Ensure all TBD players have this type
      avatar: null, // Add default avatar value
      age: null, // Add default age value
    }));

    // Obtener los TBD players existentes y asegurar el tipo correcto
    let existingTbdPlayers: TbdPlayersStructure;

    // Parse the existing tbdPlayers if there are any
    if (match.tbdPlayers) {
      try {
        const tbdData =
          typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers)
            : match.tbdPlayers;

        // Handle both array and teamA/teamB structure formats
        if (Array.isArray(tbdData)) {
          // If it's an array, separate by team
          existingTbdPlayers = {
            teamA: tbdData
              .filter((p: TbdPlayer) => p.isTeamA)
              .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
            teamB: tbdData
              .filter((p: TbdPlayer) => !p.isTeamA)
              .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
          };
        } else if (tbdData.teamA || tbdData.teamB) {
          // If it already has teamA/teamB structure
          existingTbdPlayers = {
            teamA: Array.isArray(tbdData.teamA)
              ? tbdData.teamA.map((p: TbdPlayer) => ({
                  ...p,
                  playerType: 'TBD',
                }))
              : [],
            teamB: Array.isArray(tbdData.teamB)
              ? tbdData.teamB.map((p: TbdPlayer) => ({
                  ...p,
                  playerType: 'TBD',
                }))
              : [],
          };
        } else {
          // Default empty structure
          existingTbdPlayers = { teamA: [], teamB: [] };
        }
      } catch (error) {
        console.error('Error parsing existing tbdPlayers:', error);
        existingTbdPlayers = { teamA: [], teamB: [] };
      }
    } else {
      existingTbdPlayers = { teamA: [], teamB: [] };
    }

    // Separar los nuevos TBD players por equipo
    const teamATbdPlayers = parsedTbdPlayers.filter(
      (player: TbdPlayer) => player.isTeamA
    );
    const teamBTbdPlayers = parsedTbdPlayers.filter(
      (player: TbdPlayer) => !player.isTeamA
    );

    // Actualizar los TBD players en la base de datos
    const updatedTbdPlayers: TbdPlayersStructure = {
      teamA: [...existingTbdPlayers.teamA, ...teamATbdPlayers],
      teamB: [...existingTbdPlayers.teamB, ...teamBTbdPlayers],
    };

    await prisma.match.update({
      where: { id: matchId },
      data: {
        tbdPlayers: updatedTbdPlayers as unknown as any,
      },
    });

    // Obtener la información actualizada del partido
    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: {
          where: { isTeamA: true },
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

    // Obtener los jugadores del equipo B en una consulta separada
    const teamBPlayersQuery = await prisma.matchPlayer.findMany({
      where: {
        matchId: matchId,
        isTeamA: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Crear un objeto enriquecido para devolver
    const enhancedMatch = updatedMatch
      ? {
          ...updatedMatch,
          playersB: teamBPlayersQuery.map(
            (player: (typeof teamBPlayersQuery)[0]) => ({
              id: player.userId,
              matchId: player.matchId,
              user: player.user,
            })
          ),
        }
      : null;

    return res.status(200).json({
      message: 'Jugadores TBD añadidos correctamente',
      match: enhancedMatch,
      tbdPlayers: updatedTbdPlayers,
    });
  } catch (error) {
    console.error('[TBD Players API] Error processing request:', error);
    return res.status(500).json({ message: 'Server error processing request' });
  }
}
