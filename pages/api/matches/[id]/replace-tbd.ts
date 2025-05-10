import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

// Define types for TBD players
interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

interface TbdPlayersStructure {
  teamA: TbdPlayer[];
  teamB: TbdPlayer[];
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
    const { tbdPlayerId, userId, isTeamA } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID de partido inválido' });
    }

    if (!tbdPlayerId || !userId) {
      return res.status(400).json({
        message: 'Se requiere el ID del jugador TBD y el ID del usuario real',
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
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    // Verificar que el usuario es admin del grupo o el usuario que está reemplazando
    const isAdminOrSelf =
      match.group.members.some(
        (member: (typeof match.group.members)[0]) =>
          member.userId === user.id && member.role === 'ADMIN'
      ) || user.id === userId;

    if (!isAdminOrSelf) {
      return res.status(403).json({
        message:
          'No tienes permisos para modificar este partido o sustituir este jugador',
      });
    }

    // Procesar el objeto tbdPlayers
    let tbdPlayers: TbdPlayersStructure = { teamA: [], teamB: [] };

    if (match.tbdPlayers) {
      try {
        // Parse the JSON if needed
        const tbdData =
          typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers)
            : match.tbdPlayers;

        // Handle different formats of tbdPlayers (array or object structure)
        if (Array.isArray(tbdData)) {
          // If it's a simple array, split by team
          tbdPlayers = {
            teamA: tbdData.filter((p: TbdPlayer) => p.isTeamA),
            teamB: tbdData.filter((p: TbdPlayer) => !p.isTeamA),
          };
        } else if (tbdData.teamA || tbdData.teamB) {
          // If it already has teamA/teamB structure
          tbdPlayers = {
            teamA: Array.isArray(tbdData.teamA) ? tbdData.teamA : [],
            teamB: Array.isArray(tbdData.teamB) ? tbdData.teamB : [],
          };
        }
      } catch (error) {
        console.error('Error parsing tbdPlayers:', error);
        return res.status(500).json({
          message: 'Error al procesar los jugadores TBD',
        });
      }
    }

    // Determine which team to look in based on the isTeamA parameter
    const tbdTeam = isTeamA ? 'teamA' : 'teamB';

    // Find the TBD player in the appropriate team
    const tbdPlayerIndex = tbdPlayers[tbdTeam].findIndex(
      (player: TbdPlayer) => player.id === tbdPlayerId
    );

    if (tbdPlayerIndex === -1) {
      return res.status(404).json({ message: 'Jugador TBD no encontrado' });
    }

    // Verify the user is a member of the group
    const isMember = match.group.members.some(
      (member: (typeof match.group.members)[0]) => member.userId === userId
    );

    if (!isMember) {
      return res.status(400).json({
        message: 'El usuario real debe ser miembro del grupo',
      });
    }

    // Check if the user is already assigned to the match
    const alreadyAssigned = await prisma.matchPlayer.findFirst({
      where: {
        matchId: id,
        userId,
      },
    });

    if (alreadyAssigned) {
      return res.status(400).json({
        message: 'El usuario ya está asignado a este partido',
      });
    }

    // Remove the TBD player
    const updatedTbdPlayers = {
      ...tbdPlayers,
      [tbdTeam]: tbdPlayers[tbdTeam].filter(
        (player: TbdPlayer) => player.id !== tbdPlayerId
      ),
    };

    // Update the Match table with the updated TBD players
    await prisma.match.update({
      where: { id },
      data: {
        tbdPlayers: updatedTbdPlayers as unknown as any,
      },
    });

    // Create the new real player assignment
    await prisma.matchPlayer.create({
      data: {
        matchId: id,
        userId,
        isTeamA,
      },
    });

    // Get the updated match information
    const updatedMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        playersA: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                birthdate: true,
              },
            },
          },
        },
        goals: {
          include: {
            scorer: {
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

    // Get team B players in a separate query
    const teamBPlayers = await prisma.matchPlayer.findMany({
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
            birthdate: true,
          },
        },
      },
    });

    // Get the new user information
    const newUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    return res.status(200).json({
      message: 'Jugador TBD reemplazado correctamente',
      match: {
        ...updatedMatch,
        playersB: teamBPlayers,
      },
      tbdPlayers: updatedTbdPlayers,
      replacedPlayer: {
        id: userId,
        name: newUser?.name,
        avatar: newUser?.image,
        isTeamA,
        playerType: 'CONFIRMED',
      },
    });
  } catch (error) {
    console.error('Error al reemplazar jugador TBD:', error);
    return res.status(500).json({ message: 'Error al reemplazar jugador TBD' });
  }
}
