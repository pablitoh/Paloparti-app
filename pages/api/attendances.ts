import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

interface ConfirmedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
}

/**
 * API endpoint for managing attendance to matches
 * This API only handles attendance at the match level, not group membership
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    console.log('Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
    });

    if (!session || !session.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { userId, groupId, matchId, status } = req.body;

    // Logging for debugging
    console.log('Attendance API request received:', {
      userId,
      groupId,
      matchId,
      status,
      auth: session.user.id,
      body: req.body,
      method: req.method,
      headers: {
        contentType: req.headers['content-type'],
      },
    });

    // Validate required fields
    if (!matchId || !status) {
      console.error('Missing required fields:', { matchId, status });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        details: { matchId, status },
      });
    }

    // Default userId to the authenticated user if not provided
    const targetUserId = userId || session.user.id;

    // Validate status format
    if (!['CONFIRMED', 'DECLINED', 'PENDING'].includes(status)) {
      console.error('Invalid status value:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    // Fetch the match to get the groupId if not provided
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { groupId: true },
      });

      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      targetGroupId = match.groupId;
    }

    // Verify user is a member of the group
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: targetGroupId,
        userId: targetUserId,
      },
    });

    if (!member) {
      return res
        .status(404)
        .json({ message: 'User is not a member of this group' });
    }

    // Check if requesting user is admin (can modify others) or is updating self
    const isAdmin =
      session.user.id !== targetUserId
        ? await prisma.groupMember.findFirst({
            where: {
              groupId: targetGroupId,
              userId: session.user.id,
              role: 'ADMIN',
            },
          })
        : true; // User is modifying own attendance

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only group admins can modify other members' attendance",
      });
    }

    // Get group details
    const group = await prisma.group.findUnique({
      where: { id: targetGroupId },
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get the next match ID
    const nextMatchId = matchId || group.nextMatchId;
    let updatedConfirmedPlayers: ConfirmedPlayer[] = [];

    if (!nextMatchId) {
      return res.status(404).json({
        message: 'This group does not have a next match scheduled',
        details: 'Cannot update attendance without a scheduled match',
      });
    }

    console.log(
      `Processing attendance update: userId=${targetUserId}, matchId=${nextMatchId}, status=${status}`
    );

    // Get the match details
    const matchDetails = await prisma.match.findUnique({
      where: { id: nextMatchId },
      select: { date: true, status: true },
    });

    if (!matchDetails) {
      return res.status(404).json({ message: 'Next match not found' });
    }

    // First, find if there's an existing attendance record
    const attendanceRecord = await prisma.matchAttendance.findFirst({
      where: {
        groupId: targetGroupId,
        userId: targetUserId,
        matchId: nextMatchId,
      },
    });

    console.log('Existing attendance record:', attendanceRecord);

    // If there's an existing record, update it
    if (attendanceRecord) {
      try {
        const updatedRecord = await prisma.matchAttendance.update({
          where: { id: attendanceRecord.id },
          data: { status },
        });
        console.log(
          `Updated existing attendance record for match ${nextMatchId}:`,
          updatedRecord
        );
      } catch (error) {
        console.error('Error updating attendance record:', error);
        return res.status(500).json({
          message: 'Error updating attendance record',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      // Create a new attendance record
      try {
        const newRecord = await prisma.matchAttendance.create({
          data: {
            groupId: targetGroupId,
            userId: targetUserId,
            matchId: nextMatchId,
            matchDate: matchDetails?.date || new Date(),
            status,
          },
        });
        console.log(
          `Created new attendance record for match ${nextMatchId}:`,
          newRecord
        );
      } catch (error) {
        console.error('Error creating attendance record:', error);
        return res.status(500).json({
          message: 'Error creating attendance record',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // NO SE ACTUALIZA EL ESTADO DEL MIEMBRO EN GROUP MEMBER
    // Solo se actualiza la asistencia al partido específico

    // Get all confirmed players for the next match
    const confirmedAttendances = await prisma.matchAttendance.findMany({
      where: {
        matchId: nextMatchId,
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

    // Get the match to check for formed teams
    const match = await prisma.match.findUnique({
      where: { id: nextMatchId },
      select: {
        tbdPlayers: true,
      },
    });

    // Map to the expected format
    updatedConfirmedPlayers = confirmedAttendances.map((attendance) => ({
      id: attendance.user.id,
      name: attendance.user.name,
      avatar: attendance.user.image,
    }));

    // If the match has teams formed, we need to update them
    if (match?.tbdPlayers) {
      try {
        // If a player is being removed, add a TBD player
        if (status === 'DECLINED') {
          try {
            console.log(
              `User ${targetUserId} is declining attendance, removing from teams...`
            );

            // First, check if the player is in any team and which team they're in
            const playerTeam = await prisma.matchPlayer.findFirst({
              where: {
                matchId: nextMatchId,
                userId: targetUserId,
              },
            });

            if (playerTeam) {
              console.log(
                `Player was in team ${
                  playerTeam.isTeamA ? 'A' : 'B'
                }, removing and replacing with TBD player`
              );
            } else {
              console.log('Player was not in any team yet');
            }

            // Delete the player from the match teams
            const deleteResult = await prisma.matchPlayer.deleteMany({
              where: {
                matchId: nextMatchId,
                userId: targetUserId,
              },
            });

            console.log(
              `Deleted ${deleteResult.count} player entries from teams`
            );

            // Generate a unique ID for the TBD player
            const tbdId = `tbd-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`;

            // Create a TBD player to replace them
            const newTbdPlayer = {
              id: tbdId,
              name: `TBD ${Math.floor(Math.random() * 100)}`, // Add a number to make it unique
              avatar: null,
              playerType: 'TBD',
              isTeamA: playerTeam ? playerTeam.isTeamA : true,
            };

            // Get existing TBD players or create an empty array
            let tbdPlayers = [];
            if (match?.tbdPlayers) {
              tbdPlayers =
                typeof match.tbdPlayers === 'string'
                  ? JSON.parse(match.tbdPlayers)
                  : match.tbdPlayers;
            }

            // Add the new TBD player to the array
            tbdPlayers.push(newTbdPlayer);

            // If we found which team they were in, add a new TBD player to that team
            if (playerTeam) {
              await prisma.matchPlayer.create({
                data: {
                  matchId: nextMatchId,
                  userId: tbdId,
                  isTeamA: playerTeam.isTeamA,
                },
              });
              console.log(
                `Created TBD player in team ${playerTeam.isTeamA ? 'A' : 'B'}`
              );
            } else {
              // If player wasn't in a team yet, assign to team A by default
              // This is just a safety measure
              await prisma.matchPlayer.create({
                data: {
                  matchId: nextMatchId,
                  userId: tbdId,
                  isTeamA: true,
                },
              });
              console.log(`Created TBD player in team A (default)`);
            }

            // Update the match with the new TBD player
            await prisma.match.update({
              where: { id: nextMatchId },
              data: {
                tbdPlayers: JSON.stringify(tbdPlayers),
              },
            });

            console.log(
              `Successfully added TBD player ${tbdId} to replace user ${targetUserId}`
            );

            // Verify the TBD player was added correctly
            const checkTbdPlayer = await prisma.matchPlayer.findFirst({
              where: {
                matchId: nextMatchId,
                userId: tbdId,
              },
            });

            if (checkTbdPlayer) {
              console.log(
                `Verification: TBD player ${tbdId} is in team ${
                  checkTbdPlayer.isTeamA ? 'A' : 'B'
                }`
              );
            } else {
              console.error(
                `Verification FAILED: TBD player ${tbdId} was not found in MatchPlayer table`
              );
            }
          } catch (error) {
            console.error('Error handling TBD player replacement:', error);
          }
        }
      } catch (error) {
        console.error('Error handling TBD players:', error);
      }
    }

    console.log(
      `Found ${updatedConfirmedPlayers.length} confirmed players for next match:`,
      updatedConfirmedPlayers
    );

    // Get the updated match data
    const updatedMatch = await prisma.match.findUnique({
      where: { id: nextMatchId },
      select: {
        tbdPlayers: true,
      },
    });

    // Get the players in each team
    const teamAPlayers = await prisma.matchPlayer.findMany({
      where: {
        matchId: nextMatchId,
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

    const teamBPlayers = await prisma.matchPlayer.findMany({
      where: {
        matchId: nextMatchId,
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

    // Map the players to the expected format
    const mappedPlayersA = teamAPlayers.map((player) => ({
      id: player.userId,
      name: player.user?.name || 'Unknown',
      avatar: player.user?.image,
    }));

    const mappedPlayersB = teamBPlayers.map((player) => ({
      id: player.userId,
      name: player.user?.name || 'Unknown',
      avatar: player.user?.image,
    }));

    return res.status(200).json({
      success: true,
      message: `Attendance updated to ${status.toLowerCase()}`,
      status,
      confirmedPlayers: updatedConfirmedPlayers,
      nextMatchId,
      matchDetails: {
        tbdPlayers: updatedMatch?.tbdPlayers,
        playersA: mappedPlayersA,
        playersB: mappedPlayersB,
      },
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating attendance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
