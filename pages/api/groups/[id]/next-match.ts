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
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Si no hay próximo partido
    if (!group.nextMatchId) {
      return res.status(200).json({
        nextMatchDetails: null,
        userAttendance: null,
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
        tbdPlayers: true, // Jugadores TBD y roles asignados para formación
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
            playerRoles: true, // Incluir los roles de cada asistencia
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

    // Parsear los campos teamA y teamB que están como strings JSON
    let parsedTeamA: Player[] = [];
    let parsedTeamB: Player[] = [];

    try {
      if (match.teamA) {
        if (typeof match.teamA === 'string') {
          parsedTeamA = JSON.parse(match.teamA);
        } else if (Array.isArray(match.teamA)) {
          parsedTeamA = match.teamA;
        }
      }

      if (match.teamB) {
        if (typeof match.teamB === 'string') {
          parsedTeamB = JSON.parse(match.teamB);
        } else if (Array.isArray(match.teamB)) {
          parsedTeamB = match.teamB;
        }
      }
    } catch (error) {
      console.error('Error parsing teams:', error);
      parsedTeamA = [];
      parsedTeamB = [];
    }

    // Obtener los IDs de jugadores ya asignados a equipos
    const assignedPlayerIds = new Set([
      ...parsedTeamA.map((p: any) => p.id),
      ...parsedTeamB.map((p: any) => p.id),
      ...(match.matchPlayers || [])
        .filter((mp: any) => mp.user?.id)
        .map((mp: any) => mp.user.id),
    ]);

    // Obtener los jugadores confirmados que NO están asignados a ningún equipo
    const unassignedPlayers = match.attendance.filter(
      (attendance: any) =>
        attendance.status === 'CONFIRMED' &&
        !assignedPlayerIds.has(attendance.userId)
    );

    // El unassignedCount es la cantidad de jugadores confirmados sin equipo
    const unassignedCount = unassignedPlayers.length;

    console.log('🔍 DEBUG - Cálculo de jugadores sin asignar:', {
      totalConfirmed: match.attendance.filter(
        (a: any) => a.status === 'CONFIRMED'
      ).length,
      assignedFromTeamA: parsedTeamA.length,
      assignedFromTeamB: parsedTeamB.length,
      assignedFromMatchPlayers: match.matchPlayers.filter(
        (mp: any) => mp.user?.id
      ).length,
      totalAssigned: assignedPlayerIds.size,
      unassignedCount,
    });

    // Procesar los datos del partido
    const confirmedPlayers = match.attendance
      .filter((attendance: any) => attendance.status === 'CONFIRMED')
      .map((attendance: any) => {
        let playerRoles: PlayerRole[] = [];
        if (attendance.playerRoles && Array.isArray(attendance.playerRoles)) {
          playerRoles = normalizePlayerRoles(attendance.playerRoles);
        }

        return {
          id: attendance.userId,
          name: attendance.user?.name || null,
          avatar: attendance.user?.image || null,
          age: calculateAge(attendance.user?.birthdate || null),
          playerRoles,
          starRating: starRatingsMap[attendance.userId] || 3,
          isAssigned: assignedPlayerIds.has(attendance.userId),
        };
      });

    // Obtener la asistencia del usuario actual y sus roles
    const userAttendance = match.attendance.find(
      (attendance: (typeof match.attendance)[0]) =>
        attendance.userId === session.user.id
    );

    // Extraer los roles del usuario actual si existe
    let userRoles: PlayerRole[] = [];
    if (
      userAttendance &&
      userAttendance.playerRoles &&
      Array.isArray(userAttendance.playerRoles)
    ) {
      userRoles = normalizePlayerRoles(userAttendance.playerRoles);
      console.log(
        `Roles del usuario actual recuperados:`,
        userRoles.map((r) => `${r.priority}° ${r.role}`).join(', ')
      );
    }

    // Formatear la respuesta
    // Usar matchPlayers para obtener los jugadores de cada equipo
    const teamAPlayers = (match.matchPlayers as any[])
      .filter((mp) => mp.isTeamA)
      .map((mp) => ({
        id: mp.user?.id,
        name: mp.user?.name,
        avatar: mp.user?.image,
      }))
      .filter((p) => p.id);

    const teamBPlayers = (match.matchPlayers as any[])
      .filter((mp) => !mp.isTeamA)
      .map((mp) => ({
        id: mp.user?.id,
        name: mp.user?.name,
        avatar: mp.user?.image,
      }))
      .filter((p) => p.id);

    // Función para calcular el promedio de edad
    const calculateAverageAge = (players: any[]): number | undefined => {
      const playersWithAge = players.filter(
        (p) => p.age !== null && p.age !== undefined
      );
      if (playersWithAge.length === 0) return undefined;

      const sum = playersWithAge.reduce((acc, player) => acc + player.age, 0);
      return Math.round(sum / playersWithAge.length);
    };

    // Calcular promedios de edad
    const teamAAvgAge = calculateAverageAge(parsedTeamA);
    const teamBAvgAge = calculateAverageAge(parsedTeamB);

    console.log('Calculado promedios de edad:', {
      teamAAvgAge,
      teamBAvgAge,
      teamAPlayers: parsedTeamA,
      teamBPlayers: parsedTeamB,
    });

    return res.status(200).json({
      nextMatchDetails: {
        ...match,
        teamA: parsedTeamA,
        teamB: parsedTeamB,
        confirmedPlayers,
        tbdPlayers: match.tbdPlayers || { teamA: [], teamB: [] },
        requiredPlayers: group.requiredPlayers,
        unassignedCount,
      },
      userAttendance: userAttendance?.status || null,
      userRoles,
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
