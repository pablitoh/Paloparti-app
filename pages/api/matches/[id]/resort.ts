import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

interface Player {
  userId: string;
  name?: string;
  isTeamA?: boolean;
}

interface TbdPlayer {
  id?: string;
  name?: string;
  avatar?: string | null;
  age?: number | null;
  isTeamA?: boolean;
  playerType?: 'TBD';
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

    // Get the match and check if it exists
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Check if user is admin of the group
    const isAdmin = match.group.members.some(
      (member) => member.userId === user.id && member.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        message: 'No tienes permisos para resortar equipos en este partido',
      });
    }

    // UPDATED: Random sorting of real players - shuffle the array first
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    // Split players evenly between teams
    const midPoint = Math.ceil(shuffledPlayers.length / 2);
    const teamAPlayers = shuffledPlayers.slice(0, midPoint);
    const teamBPlayers = shuffledPlayers.slice(midPoint);

    // Assign team flags to players
    teamAPlayers.forEach((player) => {
      player.isTeamA = true;
    });
    teamBPlayers.forEach((player) => {
      player.isTeamA = false;
    });

    // Get player IDs from each team
    const teamAPlayerIds = teamAPlayers.map((player) => player.userId);
    const teamBPlayerIds = teamBPlayers.map((player) => player.userId);

    // Process TBD players from the request
    let tbdPlayersData: TbdPlayersData = {
      teamA: [],
      teamB: [],
    };

    if (tbdPlayers) {
      // Count confirmed players in each team
      const confirmedTeamACount = teamAPlayerIds.length;
      const confirmedTeamBCount = teamBPlayerIds.length;
      const totalConfirmedPlayers = confirmedTeamACount + confirmedTeamBCount;

      if (Array.isArray(tbdPlayers)) {
        const totalTbdPlayers = tbdPlayers.length;
        const totalPlayers = totalConfirmedPlayers + totalTbdPlayers;
        const targetPlayersPerTeam = Math.ceil(totalPlayers / 2);

        // Calculate how many TBD players each team needs
        const tbdNeededForTeamA = Math.max(
          0,
          targetPlayersPerTeam - confirmedTeamACount
        );
        const tbdNeededForTeamB = Math.max(
          0,
          totalTbdPlayers - tbdNeededForTeamA
        );

        // Shuffle TBD players for random distribution
        const shuffledTbdPlayers = [...tbdPlayers].sort(
          () => Math.random() - 0.5
        );

        tbdPlayersData = {
          teamA: shuffledTbdPlayers.slice(0, tbdNeededForTeamA).map((p) => ({
            id:
              p.id ||
              `tbd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: p.name || 'TBD Player',
            avatar: p.avatar || null,
            age: p.age || null,
            playerType: 'TBD' as const,
            isTeamA: true,
          })),
          teamB: shuffledTbdPlayers
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
        };
      } else if (
        tbdPlayers &&
        typeof tbdPlayers === 'object' &&
        ('teamA' in tbdPlayers || 'teamB' in tbdPlayers)
      ) {
        const teamA = Array.isArray(tbdPlayers.teamA) ? tbdPlayers.teamA : [];
        const teamB = Array.isArray(tbdPlayers.teamB) ? tbdPlayers.teamB : [];
        const totalTbdPlayers = teamA.length + teamB.length;
        const totalPlayers = totalConfirmedPlayers + totalTbdPlayers;
        const targetPlayersPerTeam = Math.ceil(totalPlayers / 2);

        // Calculate how many TBD players each team needs
        const tbdNeededForTeamA = Math.max(
          0,
          targetPlayersPerTeam - confirmedTeamACount
        );
        const tbdNeededForTeamB = Math.max(
          0,
          totalTbdPlayers - tbdNeededForTeamA
        );

        // Combine all TBD players and redistribute
        const allTbdPlayers = [...teamA, ...teamB].sort(
          () => Math.random() - 0.5
        );
        tbdPlayersData = {
          teamA: allTbdPlayers.slice(0, tbdNeededForTeamA).map((p) => ({
            id:
              p.id ||
              `tbd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: p.name || 'TBD Player',
            avatar: p.avatar || null,
            age: p.age || null,
            playerType: 'TBD' as const,
            isTeamA: true,
          })),
          teamB: allTbdPlayers
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
        };
      }
    }

    console.log('TBD Players to save:', tbdPlayersData);

    // Delete existing player assignments
    await prisma.matchPlayer.deleteMany({
      where: { matchId: id },
    });

    // Create new player assignments only for real players (non-placeholders)
    if (teamAPlayerIds.length > 0 || teamBPlayerIds.length > 0) {
      const validTeamAIds = teamAPlayerIds.filter(
        (id): id is string => typeof id === 'string'
      );
      const validTeamBIds = teamBPlayerIds.filter(
        (id): id is string => typeof id === 'string'
      );

      const playerAssignments = [
        ...validTeamAIds.map((playerId) => ({
          matchId: id,
          userId: playerId,
          isTeamA: true,
        })),
        ...validTeamBIds.map((playerId) => ({
          matchId: id,
          userId: playerId,
          isTeamA: false,
        })),
      ];

      if (playerAssignments.length > 0) {
        await prisma.matchPlayer.createMany({
          data: playerAssignments,
        });
      }
    }

    // Update the match with the new TBD players
    await prisma.match.update({
      where: { id },
      data: {
        tbdPlayers: JSON.parse(JSON.stringify(tbdPlayersData)),
      },
    });

    // Get updated match with new player assignments
    const updatedMatch = await prisma.match.findUnique({
      where: { id },
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
        createdAt: true,
        updatedAt: true,
        tbdPlayers: true,
        playersA: {
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

    // Crear un objeto enriquecido para devolver
    const enhancedMatch = updatedMatch
      ? {
          ...updatedMatch,
          playersA: updatedMatch.playersA.map((player) => ({
            id: player.userId,
            name: player.user.name,
            avatar: player.user.image,
            playerType: 'TEAM',
          })),
          playersB: teamBPlayersQuery.map((player) => ({
            id: player.userId,
            name: player.user.name,
            avatar: player.user.image,
            playerType: 'TEAM',
          })),
          tbdPlayers: tbdPlayersData,
        }
      : null;

    return res.status(200).json({
      message: 'Equipos resortados correctamente',
      match: enhancedMatch,
    });
  } catch (error) {
    console.error('Error resorting teams:', error);
    return res.status(500).json({ message: 'Error al resortar equipos' });
  }
}
