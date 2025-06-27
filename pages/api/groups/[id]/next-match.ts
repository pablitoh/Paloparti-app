import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { Match, MatchPlayer, User } from '@prisma/client';
import { calculateAge } from '../../../../lib/utils';
import { PLAYER_ROLES } from '../../../../lib/matches/constants';
import {
  normalizePlayerRoles,
  PlayerRole,
  PlayerRoleType,
} from '../../../../lib/teambuilder';
import { Player } from '../../../../types/match';

// Valores de prioridad para roles (menor número = mayor prioridad)
const ROLE_PRIORITY: Record<PlayerRoleType, number> = {
  Arquero: 0,
  Defensor: 1,
  Mediocampo: 2,
  Delantero: 3,
  Comodín: 4,
};

// Interfaces for type safety
interface MatchWithRelations extends Match {
  matchPlayers: (MatchPlayer & {
    user: Pick<User, 'id' | 'name' | 'image' | 'birthdate'> | null;
  })[];
  attendance: Array<{
    userId: string;
    status: string;
    user: Pick<User, 'id' | 'name' | 'image' | 'birthdate'> | null;
  }>;
}

interface PlayerData {
  id: string;
  name: string | null;
  avatar: string | null;
  isTeamA?: boolean;
}

interface TbdPlayer {
  id: string;
  name: string;
  avatar: string | null;
  isTeamA: boolean;
  playerType: 'TBD';
}

interface ParsedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
  playerRoles?: PlayerRole[];
  role?: string | null;
  assignedRole?: string | null;
  starRating?: number;
  isTeamA?: boolean;
  positionForced?: boolean;
}

interface ConfirmedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
  playerRoles: PlayerRole[];
  role: string | null;
  assignedRole: string | null;
  starRating: number;
  isAssigned: boolean;
  isTeamA: boolean;
  isTeamB: boolean;
}

interface FormattedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  age: number | null;
  starRating: number;
  playerRoles: PlayerRole[];
  role: string | null;
  assignedRole: string | null;
  isTeamA: boolean;
  positionForced: boolean;
}

// Función para ordenar jugadores por rol
const sortPlayersByRole = (players: any[]) => {
  return [...players].sort((a, b) => {
    // Obtener rol principal de cada jugador
    const getRolePriority = (player: any) => {
      // Priorizar el rol asignado si existe
      if (
        player.assignedRole &&
        ROLE_PRIORITY[player.assignedRole as PlayerRoleType] !== undefined
      ) {
        return ROLE_PRIORITY[player.assignedRole as PlayerRoleType];
      }

      // Si no hay rol asignado, buscar en playerRoles
      if (player.playerRoles && player.playerRoles.length > 0) {
        // Encontrar el rol con mayor prioridad
        return player.playerRoles.reduce(
          (minPriority: number, role: PlayerRole) => {
            const priority = ROLE_PRIORITY[role.role as PlayerRoleType] ?? 999;
            return priority < minPriority ? priority : minPriority;
          },
          999
        );
      }

      // Si no tiene roles, asignar prioridad baja
      return 999;
    };

    const priorityA = getRolePriority(a);
    const priorityB = getRolePriority(b);

    // Ordenar por prioridad de rol
    return priorityA - priorityB;
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación usando getServerSession en lugar de getSession
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'ID de grupo inválido' });
    }

    // Obtener el grupo para encontrar el nextMatchId
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        nextMatchId: true,
        requiredPlayers: true,
        createdBy: true,
        members: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Determinar si el usuario es admin
    const isAdmin =
      group.createdBy === session.user.id || group.members[0]?.role === 'ADMIN';

    // Si no hay próximo partido
    if (!group.nextMatchId) {
      return res.status(200).json({
        nextMatchDetails: null,
        userAttendance: null,
        isAdmin,
      });
    }

    // Obtener detalles del próximo partido
    const match = await prisma.match.findUnique({
      where: { id: group.nextMatchId },
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
        sortCount: true,
        matchPlayers: {
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
        attendance: {
          select: {
            userId: true,
            status: true,
            playerRoles: true,
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
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Partido no encontrado' });
    }

    console.log('🔍 DEBUG - Match raw data:', {
      id: match.id,
      teamA: match.teamA,
      teamB: match.teamB,
      tbdPlayers: match.tbdPlayers,
      matchPlayers: match.matchPlayers.length,
      sortCount: match.sortCount,
    });

    // Obtener todos los star ratings de los miembros del grupo en una sola consulta
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        groupId: match.groupId,
      },
      select: {
        userId: true,
        starRating: true,
      },
    });

    // Crear un mapa para acceso rápido a los star ratings
    const starRatingsMap: Record<string, number> = {};
    groupMembers.forEach(
      (member: { userId: string; starRating: number | null }) => {
        starRatingsMap[member.userId] = member.starRating || 3;
      }
    );

    // Procesar los datos del partido
    const confirmedPlayers = match.attendance
      .filter((attendance: any) => attendance.status === 'CONFIRMED')
      .map((attendance: any) => {
        let playerRoles: PlayerRole[] = [];
        let assignedRole = null;

        try {
          // Obtener los roles del jugador desde tbdPlayers si existe
          if (match.tbdPlayers) {
            const tbdInfo =
              typeof match.tbdPlayers === 'string'
                ? JSON.parse(match.tbdPlayers)
                : match.tbdPlayers;

            if (tbdInfo.playerRoles?.[attendance.userId]) {
              playerRoles = tbdInfo.playerRoles[attendance.userId];
            }
            if (tbdInfo.assignedRoles?.[attendance.userId]) {
              assignedRole = tbdInfo.assignedRoles[attendance.userId];
            }
          }
        } catch (error) {
          console.error('Error parsing tbdPlayers:', error);
        }

        // Si no hay roles en tbdPlayers, usar los roles de la asistencia
        if (
          playerRoles.length === 0 &&
          attendance.playerRoles &&
          Array.isArray(attendance.playerRoles)
        ) {
          playerRoles = normalizePlayerRoles(attendance.playerRoles);
        }

        // Debug específico para avatares
        console.log('🔍 DEBUG - Avatar para usuario:', {
          userId: attendance.userId,
          userName: attendance.user?.name,
          originalImage: attendance.user?.image,
          processedAvatar: attendance.user?.image || null,
        });

        return {
          id: attendance.userId,
          name: attendance.user?.name || null,
          avatar: attendance.user?.image || null,
          age: calculateAge(attendance.user?.birthdate || null),
          playerRoles,
          assignedRole,
          role: assignedRole || playerRoles[0]?.role || null,
          starRating: starRatingsMap[attendance.userId] || 3,
          isTeamA: false,
          isTeamB: false,
        };
      });

    console.log('🔍 DEBUG - Confirmed players:', confirmedPlayers.length);

    // Obtener la asistencia del usuario actual y sus roles
    const userAttendance = match.attendance.find(
      (attendance: (typeof match.attendance)[0]) =>
        attendance.userId === session.user.id
    );

    // Parsear los campos teamA y teamB que están como strings JSON
    let formattedTeamA: FormattedPlayer[] = [];
    let formattedTeamB: FormattedPlayer[] = [];

    // Primero intentar parsear desde teamA y teamB (donde create-match guarda los equipos)
    console.log('🔍 DEBUG - Intentando parsear desde teamA/teamB');
    try {
      if (match.teamA) {
        const parsedTeamA =
          typeof match.teamA === 'string'
            ? JSON.parse(match.teamA)
            : match.teamA;

        formattedTeamA = Array.isArray(parsedTeamA)
          ? parsedTeamA.map((player) => ({
              ...player,
              isTeamA: true,
              positionForced: player.positionForced || false,
              playerRoles: (player.playerRoles || []).map((role: any) => {
                if (typeof role === 'string') {
                  return { role, priority: 1 };
                }
                if (
                  role &&
                  typeof role === 'object' &&
                  'role' in role &&
                  'priority' in role &&
                  typeof role.role === 'string'
                ) {
                  return { role: role.role, priority: role.priority };
                }
                return role;
              }),
              assignedRole: player.assignedRole || player.role || null,
            }))
          : [];
      }

      if (match.teamB) {
        const parsedTeamB =
          typeof match.teamB === 'string'
            ? JSON.parse(match.teamB)
            : match.teamB;

        formattedTeamB = Array.isArray(parsedTeamB)
          ? parsedTeamB.map((player) => ({
              ...player,
              isTeamA: false,
              positionForced: player.positionForced || false,
              playerRoles: (player.playerRoles || []).map((role: any) => {
                if (typeof role === 'string') {
                  return { role, priority: 1 };
                }
                if (
                  role &&
                  typeof role === 'object' &&
                  'role' in role &&
                  'priority' in role &&
                  typeof role.role === 'string'
                ) {
                  return { role: role.role, priority: role.priority };
                }
                return role;
              }),
              assignedRole: player.assignedRole || player.role || null,
            }))
          : [];
      }

      console.log('🔍 DEBUG - Equipos parseados desde JSON:', {
        teamACount: formattedTeamA.length,
        teamBCount: formattedTeamB.length,
      });
    } catch (error) {
      console.error('Error parsing teams from database:', error);
      formattedTeamA = [];
      formattedTeamB = [];
    }

    // Solo usar matchPlayers si no hay equipos en los campos JSON
    if (formattedTeamA.length === 0 && formattedTeamB.length === 0) {
      console.log('🔍 DEBUG - No hay equipos en JSON, usando matchPlayers');

      const teamAPlayers = match.matchPlayers
        .filter((mp: { isTeamA: boolean; user: any }) => mp.isTeamA && mp.user)
        .map((mp: { user: any }) => {
          const player = confirmedPlayers.find(
            (p: ConfirmedPlayer) => p.id === mp.user.id
          );

          // Debug específico para avatares en teamA
          console.log('🔍 DEBUG - Avatar teamA player:', {
            userId: mp.user.id,
            userName: mp.user.name,
            originalImage: mp.user.image,
            processedAvatar: mp.user.image || null,
          });

          return {
            id: mp.user.id,
            name: mp.user.name || null,
            avatar: mp.user.image || null,
            age: calculateAge(mp.user.birthdate || null),
            playerRoles: player?.playerRoles || [],
            assignedRole: player?.assignedRole || null,
            role: player?.role || null,
            starRating: starRatingsMap[mp.user.id] || 3,
            isTeamA: true,
            positionForced: false,
          };
        });

      const teamBPlayers = match.matchPlayers
        .filter((mp: { isTeamA: boolean; user: any }) => !mp.isTeamA && mp.user)
        .map((mp: { user: any }) => {
          const player = confirmedPlayers.find(
            (p: ConfirmedPlayer) => p.id === mp.user.id
          );

          // Debug específico para avatares en teamB
          console.log('🔍 DEBUG - Avatar teamB player:', {
            userId: mp.user.id,
            userName: mp.user.name,
            originalImage: mp.user.image,
            processedAvatar: mp.user.image || null,
          });

          return {
            id: mp.user.id,
            name: mp.user.name || null,
            avatar: mp.user.image || null,
            age: calculateAge(mp.user.birthdate || null),
            playerRoles: player?.playerRoles || [],
            assignedRole: player?.assignedRole || null,
            role: player?.role || null,
            starRating: starRatingsMap[mp.user.id] || 3,
            isTeamA: false,
            positionForced: false,
          };
        });

      formattedTeamA = teamAPlayers;
      formattedTeamB = teamBPlayers;
    } else {
      console.log('🔍 DEBUG - Usando equipos desde campos JSON');

      // Actualizar avatares con datos frescos de la base de datos para equipos desde JSON
      const allPlayerIds = [...formattedTeamA, ...formattedTeamB].map(
        (p) => p.id
      );

      if (allPlayerIds.length > 0) {
        const freshUserData = await prisma.user.findMany({
          where: {
            id: {
              in: allPlayerIds,
            },
          },
          select: {
            id: true,
            image: true,
            name: true,
            birthdate: true,
          },
        });

        const userDataMap = new Map(
          freshUserData.map(
            (user: {
              id: string;
              image: string | null;
              name: string | null;
              birthdate: Date | null;
            }) => [user.id, user]
          )
        );

        // Actualizar avatares en teamA
        formattedTeamA = formattedTeamA.map((player) => {
          const freshData = userDataMap.get(player.id) as
            | {
                id: string;
                image: string | null;
                name: string | null;
                birthdate: Date | null;
              }
            | undefined;
          return {
            ...player,
            avatar: freshData?.image || player.avatar,
            name: freshData?.name || player.name,
            age: freshData?.birthdate
              ? calculateAge(freshData.birthdate)
              : player.age,
          };
        });

        // Actualizar avatares en teamB
        formattedTeamB = formattedTeamB.map((player) => {
          const freshData = userDataMap.get(player.id) as
            | {
                id: string;
                image: string | null;
                name: string | null;
                birthdate: Date | null;
              }
            | undefined;
          return {
            ...player,
            avatar: freshData?.image || player.avatar,
            name: freshData?.name || player.name,
            age: freshData?.birthdate
              ? calculateAge(freshData.birthdate)
              : player.age,
          };
        });

        console.log(
          '🔍 DEBUG - Avatares actualizados desde BD para equipos JSON'
        );
      }
    }

    console.log('🔍 DEBUG - Players from matchPlayers:', {
      teamAPlayers: match.matchPlayers.filter(
        (mp: { isTeamA: boolean }) => mp.isTeamA
      ).length,
      teamBPlayers: match.matchPlayers.filter(
        (mp: { isTeamA: boolean }) => !mp.isTeamA
      ).length,
    });

    // Procesar tbdPlayers
    let tbdPlayersProcessed = {
      teamA: [] as any[],
      teamB: [] as any[],
    };

    try {
      if (match.tbdPlayers) {
        const tbdInfo =
          typeof match.tbdPlayers === 'string'
            ? JSON.parse(match.tbdPlayers)
            : match.tbdPlayers;

        if (tbdInfo.teamA) {
          tbdPlayersProcessed.teamA = tbdInfo.teamA.map((player: any) => ({
            ...player,
            playerRoles: (player.playerRoles || []).map((role: any) => {
              if (typeof role === 'string') {
                return { role, priority: 1 };
              }
              if (
                role &&
                typeof role === 'object' &&
                'role' in role &&
                'priority' in role &&
                typeof role.role === 'string'
              ) {
                return { role: role.role, priority: role.priority };
              }
              return role;
            }),
          }));
        }

        if (tbdInfo.teamB) {
          tbdPlayersProcessed.teamB = tbdInfo.teamB.map((player: any) => ({
            ...player,
            playerRoles: (player.playerRoles || []).map((role: any) => {
              if (typeof role === 'string') {
                return { role, priority: 1 };
              }
              if (
                role &&
                typeof role === 'object' &&
                'role' in role &&
                'priority' in role &&
                typeof role.role === 'string'
              ) {
                return { role: role.role, priority: role.priority };
              }
              return role;
            }),
          }));
        }
      }
    } catch (error) {
      console.error('Error processing tbdPlayers:', error);
    }

    // Combinar jugadores reales con TBD players
    const finalTeamA = [...formattedTeamA, ...tbdPlayersProcessed.teamA];
    const finalTeamB = [...formattedTeamB, ...tbdPlayersProcessed.teamB];

    console.log('🔍 DEBUG - Equipos finales con TBD:', {
      teamACount: finalTeamA.length,
      teamBCount: finalTeamB.length,
      realPlayersA: formattedTeamA.length,
      realPlayersB: formattedTeamB.length,
      tbdPlayersA: tbdPlayersProcessed.teamA.length,
      tbdPlayersB: tbdPlayersProcessed.teamB.length,
    });

    return res.status(200).json({
      nextMatchDetails: {
        id: match.id,
        date: match.date,
        location: match.location,
        teamA: finalTeamA,
        teamB: finalTeamB,
        confirmedPlayers: confirmedPlayers.map((p: ConfirmedPlayer) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          age: p.age,
          starRating: p.starRating,
          isAssigned:
            formattedTeamA.some((t) => t.id === p.id) ||
            formattedTeamB.some((t) => t.id === p.id),
        })),
        tbdPlayers: tbdPlayersProcessed,
        sortCount: match.sortCount || 0,
      },
      userAttendance: userAttendance?.status || null,
      userRoles: userAttendance?.playerRoles || [],
      isAdmin,
    });
  } catch (error) {
    console.error('Error al obtener próximo partido:', error);
    return res.status(500).json({
      message: 'Error interno del servidor',
      error: String(error),
      // Add stack trace for better debugging
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
