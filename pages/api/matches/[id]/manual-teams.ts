import { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { Prisma } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id: matchId } = req.query;
    const { teamA, teamB } = req.body;

    // Get the match and verify it exists
    const match = await prisma.match.findUnique({
      where: { id: matchId as string },
      select: {
        id: true,
        groupId: true,
        date: true,
        location: true,
        teamA: true,
        teamB: true,
        scoreA: true,
        scoreB: true,
        status: true,
        group: true,
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Verify user is admin of the group
    const isAdmin = await prisma.groupMember.findFirst({
      where: {
        groupId: match.groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Calculate required players per team
    const requiredPlayersPerTeam = Math.ceil(match.group.requiredPlayers / 2);

    // Prepare teams with TBD players if needed
    const prepareTeam = (team: any[], isTeamA: boolean) => {
      const currentPlayers = team.map((player: any) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        playerType: 'TEAM',
      }));

      // Add TBD players if needed
      const tbdPlayers = [];
      while (
        currentPlayers.length + tbdPlayers.length <
        requiredPlayersPerTeam
      ) {
        tbdPlayers.push({
          id: `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: 'A determinar',
          avatar: null,
          isTeamA,
          playerType: 'TBD',
        });
      }

      return [...currentPlayers, ...tbdPlayers];
    };

    const finalTeamA = prepareTeam(teamA, true);
    const finalTeamB = prepareTeam(teamB, false);

    // First delete existing match players
    await prisma.matchPlayer.deleteMany({
      where: { matchId: matchId as string },
    });

    // Create new match players for non-TBD players
    const realPlayersA = finalTeamA.filter(
      (p: any) => !p.id.startsWith('tbd-')
    );
    const realPlayersB = finalTeamB.filter(
      (p: any) => !p.id.startsWith('tbd-')
    );

    // Create matchPlayer records for each real player
    await prisma.matchPlayer.createMany({
      data: [
        ...realPlayersA.map((player: any) => ({
          userId: player.id,
          matchId: matchId as string,
          isTeamA: true,
        })),
        ...realPlayersB.map((player: any) => ({
          userId: player.id,
          matchId: matchId as string,
          isTeamA: false,
        })),
      ],
    });

    // Prepare the tbdPlayers data as an array with isTeamA property
    // This format is consistent with what the frontend expects
    const tbdPlayersArray = [
      ...finalTeamA
        .filter((p: any) => p.id.startsWith('tbd-'))
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'A determinar',
          avatar: p.avatar || null,
          playerType: 'TBD',
          isTeamA: true,
        })),
      ...finalTeamB
        .filter((p: any) => p.id.startsWith('tbd-'))
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'A determinar',
          avatar: p.avatar || null,
          playerType: 'TBD',
          isTeamA: false,
        })),
    ];

    // Load the players with their details from the database
    const teamAPlayersWithDetails = await prisma.matchPlayer.findMany({
      where: {
        matchId: matchId as string,
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

    const teamBPlayersWithDetails = await prisma.matchPlayer.findMany({
      where: {
        matchId: matchId as string,
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

    // Format the player data for team A and B
    const formattedTeamA = teamAPlayersWithDetails.map(
      (player: (typeof teamAPlayersWithDetails)[0]) => ({
        id: player.user.id,
        name: player.user.name,
        avatar: player.user.image,
        playerType: 'TEAM',
        isTeamA: true,
      })
    );

    const formattedTeamB = teamBPlayersWithDetails.map(
      (player: (typeof teamBPlayersWithDetails)[0]) => ({
        id: player.user.id,
        name: player.user.name,
        avatar: player.user.image,
        playerType: 'TEAM',
        isTeamA: false,
      })
    );

    // Get the TBD players for each team from the array
    const tbdPlayersTeamA = tbdPlayersArray.filter(
      (p: any) => p.isTeamA === true
    );
    const tbdPlayersTeamB = tbdPlayersArray.filter(
      (p: any) => p.isTeamA === false
    );

    // Update the match with all the data
    const updatedMatch = await prisma.match.update({
      where: { id: matchId as string },
      data: {
        tbdPlayers: JSON.parse(JSON.stringify(tbdPlayersArray)),
        // Además guardar los equipos completos en los campos playersA y playersB
        playersA: JSON.parse(
          JSON.stringify([...formattedTeamA, ...tbdPlayersTeamA])
        ),
        playersB: JSON.parse(
          JSON.stringify([...formattedTeamB, ...tbdPlayersTeamB])
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
        group: true,
      },
    });

    // Format the complete response
    const matchResponse = {
      ...updatedMatch,
      tbdPlayers: tbdPlayersArray,
      // Include these fields for backwards compatibility
      playersA: [...formattedTeamA, ...tbdPlayersTeamA],
      playersB: [...formattedTeamB, ...tbdPlayersTeamB],
      confirmedPlayers: [...formattedTeamA, ...formattedTeamB],
    };

    return res.status(200).json({
      message: 'Teams updated successfully',
      match: matchResponse,
    });
  } catch (error) {
    console.error('Error updating teams:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: String(error),
    });
  }
}
