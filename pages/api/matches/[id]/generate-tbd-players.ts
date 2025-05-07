import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType: string;
  avatar: string | null;
  age: number | null;
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
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get match ID from URL
    const { id: matchId } = req.query;
    if (!matchId || typeof matchId !== 'string') {
      return res.status(400).json({ message: 'Invalid match ID' });
    }

    // Get the match and group
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Verify user is a member with appropriate access
    const userMembership = match.group.members.find(
      (member: (typeof match.group.members)[0]) => member.userId === user.id
    );

    if (!userMembership) {
      return res
        .status(403)
        .json({ message: 'You are not a member of this group' });
    }

    const isAdmin = userMembership.role === 'ADMIN';

    // Get confirmed attendances for this match
    const confirmedAttendances = await prisma.matchAttendance.findMany({
      where: {
        matchId,
        status: 'CONFIRMED',
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

    // Get required players count from the group
    const requiredPlayers = match.group.requiredPlayers || 10;

    // Calculate how many TBD players we need
    const confirmedCount = confirmedAttendances.length;
    const missingPlayers = requiredPlayers - confirmedCount;

    if (missingPlayers <= 0) {
      return res.status(200).json({
        message: 'No TBD players needed',
        requiredPlayers,
        confirmedPlayers: confirmedCount,
        missingPlayers: 0,
      });
    }

    // Create new TBD players
    const newTbdPlayers: TbdPlayer[] = Array.from(
      { length: missingPlayers },
      (_, i) => ({
        id: `tbd-${Date.now()}-${i}-${Math.random()
          .toString(36)
          .substring(2, 9)}`,
        name: `TBD Player ${i + 1}`,
        isTeamA: i % 2 === 0, // Alternate between teams
        playerType: 'TBD',
        avatar: null,
        age: null,
      })
    );

    // Get existing TBD players
    let existingTbdPlayers: TbdPlayersStructure = { teamA: [], teamB: [] };

    if (match.tbdPlayers) {
      try {
        const tbdData =
          typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers)
            : match.tbdPlayers;

        if (Array.isArray(tbdData)) {
          existingTbdPlayers = {
            teamA: tbdData
              .filter((p: TbdPlayer) => p.isTeamA)
              .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
            teamB: tbdData
              .filter((p: TbdPlayer) => !p.isTeamA)
              .map((p: TbdPlayer) => ({ ...p, playerType: 'TBD' })),
          };
        } else if (tbdData.teamA || tbdData.teamB) {
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
        console.error('Error parsing existing TBD players:', error);
      }
    }

    // Separate new TBD players by team
    const teamATbdPlayers = newTbdPlayers.filter((player) => player.isTeamA);
    const teamBTbdPlayers = newTbdPlayers.filter((player) => !player.isTeamA);

    // Combine with existing TBD players
    const updatedTbdPlayers: TbdPlayersStructure = {
      teamA: [...existingTbdPlayers.teamA, ...teamATbdPlayers],
      teamB: [...existingTbdPlayers.teamB, ...teamBTbdPlayers],
    };

    // Update match with new TBD players
    await prisma.match.update({
      where: { id: matchId },
      data: {
        tbdPlayers: updatedTbdPlayers as unknown as any,
      },
    });

    return res.status(200).json({
      message: 'TBD players generated successfully',
      requiredPlayers,
      confirmedPlayers: confirmedCount,
      generatedPlayers: missingPlayers,
      tbdPlayers: updatedTbdPlayers,
    });
  } catch (error) {
    console.error('Error generating TBD players:', error);
    return res.status(500).json({ message: 'Error generating TBD players' });
  }
}
