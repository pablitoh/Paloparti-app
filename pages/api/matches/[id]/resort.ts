import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '../../../../lib/auth';
import { Prisma } from '@prisma/client';
import { logGroupEvent } from '../../../../utils/serverLogEvents';
import { LogAction } from '../../../../utils/logTypes';

interface Player {
  userId: string;
  name?: string;
  isTeamA?: boolean;
}

interface TbdPlayer {
  id: string;
  name: string;
  avatar: string | null;
  age?: number | null;
  isTeamA: boolean;
  playerType: 'TBD';
}

interface TbdPlayersData {
  teamA: TbdPlayer[];
  teamB: TbdPlayer[];
}

interface RequestBody {
  players: Player[];
  tbdPlayers: TbdPlayer[] | TbdPlayersData | Array<TbdPlayer>;
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
    const { players, tbdPlayers } = req.body as RequestBody;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de partido inválido' });
    }

    // Validar que players sea un array y tenga el formato correcto
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        message: 'Se requiere un array de jugadores con el formato correcto',
      });
    }

    // Obtener el partido y verificar permisos en una sola consulta
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: {
              where: {
                userId: user.id,
                role: 'ADMIN',
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Verificar si el usuario es admin
    if (!match.group.members.length) {
      return res.status(403).json({
        message: 'No tienes permisos para resortar equipos en este partido',
      });
    }

    // Aleatorizar jugadores reales
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const midPoint = Math.ceil(shuffledPlayers.length / 2);
    const teamAPlayers = shuffledPlayers
      .slice(0, midPoint)
      .map((p) => ({ ...p, isTeamA: true }));
    const initialTeamBPlayers = shuffledPlayers
      .slice(midPoint)
      .map((p) => ({ ...p, isTeamA: false }));

    // Procesar TBD players
    let tbdPlayersArray: TbdPlayer[] = [];

    if (tbdPlayers) {
      const confirmedTeamACount = teamAPlayers.length;
      const confirmedTeamBCount = initialTeamBPlayers.length;
      const totalConfirmedPlayers = confirmedTeamACount + confirmedTeamBCount;

      // Normalizar tbdPlayers a un array
      const normalizedTbdPlayers = Array.isArray(tbdPlayers)
        ? tbdPlayers
        : 'teamA' in tbdPlayers || 'teamB' in tbdPlayers
        ? [
            ...(Array.isArray(tbdPlayers.teamA) ? tbdPlayers.teamA : []),
            ...(Array.isArray(tbdPlayers.teamB) ? tbdPlayers.teamB : []),
          ]
        : [];

      const totalTbdPlayers = normalizedTbdPlayers.length;
      const totalPlayers = totalConfirmedPlayers + totalTbdPlayers;
      const targetPlayersPerTeam = Math.ceil(totalPlayers / 2);

      // Calcular cuántos TBD players necesita cada equipo
      const tbdNeededForTeamA = Math.max(
        0,
        targetPlayersPerTeam - confirmedTeamACount
      );
      const tbdNeededForTeamB = Math.max(
        0,
        totalTbdPlayers - tbdNeededForTeamA
      );

      // Aleatorizar y distribuir TBD players
      const shuffledTbdPlayers = [...normalizedTbdPlayers].sort(
        () => Math.random() - 0.5
      );

      // Create an array of TBD players with isTeamA property
      tbdPlayersArray = [
        ...shuffledTbdPlayers.slice(0, tbdNeededForTeamA).map((p) => ({
          id:
            p.id ||
            `tbd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: p.name || 'TBD Player',
          avatar: p.avatar || null,
          age: p.age || null,
          playerType: 'TBD' as const,
          isTeamA: true,
        })),
        ...shuffledTbdPlayers
          .slice(tbdNeededForTeamA, tbdNeededForTeamA + tbdNeededForTeamB)
          .map((p) => ({
            id:
              p.id ||
              `tbd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: p.name || 'TBD Player',
            avatar: p.avatar || null,
            age: p.age || null,
            playerType: 'TBD' as const,
            isTeamA: false,
          })),
      ];
    }

    // Realizar todas las operaciones de base de datos en una transacción
    const result = await prisma.$transaction([
      // Eliminar asignaciones existentes
      prisma.matchPlayer.deleteMany({
        where: { matchId: id },
      }),

      // Crear nuevas asignaciones para jugadores reales
      teamAPlayers.length > 0 || initialTeamBPlayers.length > 0
        ? prisma.matchPlayer.createMany({
            data: [
              ...teamAPlayers.map((p) => ({
                matchId: id,
                userId: p.userId,
                isTeamA: true,
              })),
              ...initialTeamBPlayers.map((p) => ({
                matchId: id,
                userId: p.userId,
                isTeamA: false,
              })),
            ],
          })
        : prisma.matchPlayer.createMany({
            data: [],
          }),

      // Actualizar el partido con los nuevos TBD players como un array y actualizar los campos playersA y playersB
      prisma.match.update({
        where: { id },
        data: {
          tbdPlayers: JSON.parse(JSON.stringify(tbdPlayersArray)),
          // Añadir los campos playersA y playersB para almacenar los equipos completos
          playersA: JSON.parse(
            JSON.stringify([
              ...teamAPlayers.map((p) => ({
                id: p.userId,
                name: p.name,
                avatar: null,
                playerType: 'TEAM',
              })),
              ...tbdPlayersArray.filter((p) => p.isTeamA === true),
            ])
          ),
          playersB: JSON.parse(
            JSON.stringify([
              ...initialTeamBPlayers.map((p) => ({
                id: p.userId,
                name: p.name,
                avatar: null,
                playerType: 'TEAM',
              })),
              ...tbdPlayersArray.filter((p) => p.isTeamA === false),
            ])
          ),
        },
        select: {
          id: true,
          date: true,
          location: true,
          groupId: true,
          teamA: true,
          teamB: true,
          scoreA: true,
          scoreB: true,
          status: true,
        },
      }),
    ]);

    // Obtener los jugadores del equipo A en una consulta separada
    const teamAPlayersWithDetails = await prisma.matchPlayer.findMany({
      where: {
        matchId: id,
        isTeamA: true,
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

    // Obtener los jugadores del equipo B en una consulta separada
    const teamBPlayersWithDetails = await prisma.matchPlayer.findMany({
      where: {
        matchId: id,
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

    // Obtener los equipos anteriores antes de la transacción
    const previousTeamAPlayers = await prisma.matchPlayer.findMany({
      where: {
        matchId: id,
        isTeamA: true,
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

    const previousTeamBPlayers = await prisma.matchPlayer.findMany({
      where: {
        matchId: id,
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

    // Obtener TBD players anteriores del match
    let previousTbdPlayers: TbdPlayer[] = [];
    try {
      const previousMatch = await prisma.match.findUnique({
        where: { id },
        select: { tbdPlayers: true },
      });

      if (previousMatch?.tbdPlayers) {
        const tbdData =
          typeof previousMatch.tbdPlayers === 'string'
            ? JSON.parse(previousMatch.tbdPlayers)
            : previousMatch.tbdPlayers;

        if (Array.isArray(tbdData)) {
          previousTbdPlayers = tbdData;
        }
      }
    } catch (error) {
      console.error('Error parsing previous TBD players:', error);
    }

    // Get TBD players for each team
    const tbdPlayersTeamA = tbdPlayersArray.filter((p) => p.isTeamA === true);
    const tbdPlayersTeamB = tbdPlayersArray.filter((p) => p.isTeamA === false);

    // Preparar equipos anteriores para el log (incluyendo TBD players)
    const previousTbdTeamA = previousTbdPlayers.filter(
      (p) => p.isTeamA === true
    );
    const previousTbdTeamB = previousTbdPlayers.filter(
      (p) => p.isTeamA === false
    );

    const previousTeams = {
      teamA: [
        ...previousTeamAPlayers.map(
          (player: {
            userId: string;
            user: { name: string | null; image: string | null };
          }) => ({
            id: player.userId,
            name: player.user.name || 'Jugador',
            role: 'N/A',
          })
        ),
        ...previousTbdTeamA.map((p) => ({
          id: p.id,
          name: p.name,
          role: 'TBD',
        })),
      ],
      teamB: [
        ...previousTeamBPlayers.map(
          (player: {
            userId: string;
            user: { name: string | null; image: string | null };
          }) => ({
            id: player.userId,
            name: player.user.name || 'Jugador',
            role: 'N/A',
          })
        ),
        ...previousTbdTeamB.map((p) => ({
          id: p.id,
          name: p.name,
          role: 'TBD',
        })),
      ],
    };

    // Preparar equipos nuevos para el log
    const newTeams = {
      teamA: [
        ...teamAPlayers.map((p) => ({
          id: p.userId,
          name: p.name || 'Jugador',
          role: 'N/A',
        })),
        ...tbdPlayersTeamA.map((p) => ({
          id: p.id,
          name: p.name,
          role: 'TBD',
        })),
      ],
      teamB: [
        ...initialTeamBPlayers.map((p) => ({
          id: p.userId,
          name: p.name || 'Jugador',
          role: 'N/A',
        })),
        ...tbdPlayersTeamB.map((p) => ({
          id: p.id,
          name: p.name,
          role: 'TBD',
        })),
      ],
    };

    // Preparar la respuesta
    const enhancedMatch = {
      ...result[2],
      playersA: [
        ...teamAPlayersWithDetails.map(
          (player: {
            userId: string;
            user: { name: string | null; image: string | null };
          }) => ({
            id: player.userId,
            name: player.user.name,
            avatar: player.user.image,
            playerType: 'TEAM',
          })
        ),
        ...tbdPlayersTeamA,
      ],
      playersB: [
        ...teamBPlayersWithDetails.map(
          (player: {
            userId: string;
            user: { name: string | null; image: string | null };
          }) => ({
            id: player.userId,
            name: player.user.name,
            avatar: player.user.image,
            playerType: 'TEAM',
          })
        ),
        ...tbdPlayersTeamB,
      ],
      tbdPlayers: tbdPlayersArray,
    };

    // Registrar el evento en el log
    await logGroupEvent(match.group.id, user.id, LogAction.TEAM_RESORTED, {
      matchId: id,
      matchDate: match.date,
      matchLocation: match.location,
      teamAName: match.teamA || 'Equipo A',
      teamBName: match.teamB || 'Equipo B',
      previousTeams,
      newTeams,
      totalPlayers: teamAPlayers.length + initialTeamBPlayers.length,
      tbdPlayersCount: tbdPlayersArray.length,
      balancingCriteria: {
        byAge: false,
        byRole: false,
        byRating: false, // Re-sorteo manual, sin criterios automáticos
      },
    });

    return res.status(200).json({
      message: 'Equipos resortados correctamente',
      match: enhancedMatch,
    });
  } catch (error) {
    console.error('Error resorting teams:', error);
    return res.status(500).json({
      message:
        error instanceof Error ? error.message : 'Error al resortar equipos',
    });
  }
}
