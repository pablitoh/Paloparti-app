import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { logGroupEvent } from '../../../utils/serverLogEvents';
import { LogAction } from '../../../utils/logTypes';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Importar tipos y constantes
import {
  Member,
  TeamFormationRequest,
  TbdPlayer,
} from '../../../lib/matches/types';
import { PLAYER_ROLES } from '../../../lib/matches/constants';

// Importar utilidades de roles
import {
  getPrimaryRole,
  sortPlayersByRole,
} from '../../../lib/matches/roleUtils';

// Importar algoritmos de balanceo
import { createIntelligentRoleBalancedTeams } from '../../../lib/matches/teamBalancer';
import {
  createRatingBalancedTeams,
  createRandomTeams,
} from '../../../lib/matches/advancedBalancer';

// Importar nuevo algoritmo unificado
import { createUnifiedBalancedTeams } from '../../../lib/matches/unifiedBalancer';

// Importar utilidades de partidos
import {
  calculateAverageAge,
  addTbdPlayers,
  verifyFinalTeams,
  removeDuplicates,
  ensureEvenRealPlayerDistribution,
} from '../../../lib/matches/matchUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    console.log('No authenticated session found in /api/matches/create-match');
    return res.status(401).json({ message: 'No autenticado' });
  }

  const userId = session.user.id;
  console.log('User ID from session in /api/matches/create-match:', userId);

  // Buscar el usuario en la base de datos
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    console.log('User not found in database for /api/matches/create-match');
    return res.status(401).json({ message: 'Usuario no encontrado' });
  }

  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const {
      groupId,
      date,
      location,
      balanceByAge = false,
      balanceByRole = true,
      balanceByRating = false,
      teamA = null,
      teamB = null,
      mode = 'auto',
      matchId = null,
      isResort = false,
      players = [],
      tbdPlayersInput = { teamA: [], teamB: [] },
      allowTbdPlayers: allowTbdPlayersParam = true,
      useRandomAlgorithm = false,
    } = req.body;

    let allowTbdPlayers = allowTbdPlayersParam;

    // Validar campos requeridos
    if (!groupId) {
      return res.status(400).json({ message: 'Se requiere el ID del grupo' });
    }

    // Verificar permisos de administrador
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'ADMIN',
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: 'No tienes permisos de administrador para este grupo',
      });
    }

    // Manejar re-sorteo de partido existente
    let existingMatch = null;
    let previousTeams = null;

    if (isResort && matchId) {
      existingMatch = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!existingMatch) {
        return res.status(404).json({ message: 'Partido no encontrado' });
      }

      if (existingMatch.groupId !== groupId) {
        return res.status(403).json({
          message: 'El partido no pertenece al grupo especificado',
        });
      }

      if (existingMatch.status !== 'PENDING') {
        return res.status(400).json({
          message: 'Solo se pueden reorganizar partidos pendientes',
        });
      }

      // Detectar si es primera vez basándose en sortCount
      const actuallyFirstTime =
        !existingMatch.sortCount || existingMatch.sortCount === 0;

      if (actuallyFirstTime) {
        console.log('🎯 PRIMERA VEZ sorteando equipos, generando TBD players');
        allowTbdPlayers = true;
      } else {
        console.log(
          `🎯 RE-SORTEO de equipos (sortCount = ${existingMatch.sortCount})`
        );
        if (allowTbdPlayersParam === true) {
          allowTbdPlayers = true;
        }
      }

      console.log('🔍 Estado final de allowTbdPlayers:', {
        allowTbdPlayersParam,
        allowTbdPlayers,
        actuallyFirstTime,
        sortCount: existingMatch?.sortCount,
        isResort,
        matchId,
      });
    }

    // Obtener jugadores que confirmaron asistencia al partido
    let confirmedAttendances = [];
    let matchForRoles = null;

    if (isResort && existingMatch) {
      // Para re-sorteo, usar las asistencias del partido existente
      confirmedAttendances = await prisma.matchAttendance.findMany({
        where: {
          matchId: existingMatch.id,
          status: 'CONFIRMED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              birthdate: true,
            },
          },
        },
      });
      matchForRoles = existingMatch;
    } else {
      // Para nuevo partido, usar el nextMatch del grupo
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { nextMatchId: true },
      });

      if (!group?.nextMatchId) {
        return res.status(400).json({
          message: 'No hay un próximo partido programado para este grupo',
        });
      }

      confirmedAttendances = await prisma.matchAttendance.findMany({
        where: {
          matchId: group.nextMatchId,
          status: 'CONFIRMED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              birthdate: true,
            },
          },
        },
      });

      // Los roles ahora están en MatchAttendance, no se necesita consulta extra
    }

    // Obtener los starRating de los miembros del grupo
    const memberRatings = await prisma.groupMember.findMany({
      where: {
        groupId,
        userId: {
          in: confirmedAttendances.map((att: any) => att.user.id),
        },
        status: 'CONFIRMED',
      },
      select: {
        userId: true,
        starRating: true,
      },
    });

    const ratingsMap = new Map(
      memberRatings.map((member: any) => [member.userId, member.starRating])
    );

    if (confirmedAttendances.length === 0) {
      return res.status(400).json({
        message: 'No hay jugadores que confirmaron asistencia al partido',
      });
    }

    console.log(
      `👥 Jugadores con asistencia confirmada: ${confirmedAttendances.length}`
    );

    // Los roles ahora están directamente en MatchAttendance.playerRoles
    console.log(
      `🎯 Roles obtenidos desde MatchAttendance: ${
        confirmedAttendances.filter((att: any) => att.playerRoles).length
      } jugadores con roles`
    );

    // Convertir a formato Member
    const members: Member[] = confirmedAttendances.map((attendance: any) => {
      const userId = attendance.user.id;

      // Obtener roles directamente de la asistencia
      let userPlayerRoles = [];
      if (attendance.playerRoles && Array.isArray(attendance.playerRoles)) {
        // Convertir a formato correcto si es necesario
        userPlayerRoles = attendance.playerRoles.map(
          (role: any, index: number) => {
            if (typeof role === 'string') {
              return { role, priority: index + 1 };
            }
            return role; // Ya está en formato { role, priority }
          }
        );
      }

      // Calcular edad dinámicamente si hay fecha de nacimiento
      let calculatedAge = null;
      if (attendance.user.birthdate) {
        const birthDate = new Date(attendance.user.birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        calculatedAge = age;
      }

      console.log(
        `👤 ${attendance.user.name}: ${userPlayerRoles.length} roles encontrados`
      );

      return {
        id: userId,
        name: attendance.user.name,
        birthdate: attendance.user.birthdate,
        age: calculatedAge, // Edad calculada dinámicamente
        role: getPrimaryRole(userPlayerRoles) || 'No especificado',
        playerRoles: userPlayerRoles,
        starRating: ratingsMap.get(userId) || 3, // Default rating si no se encuentra
      };
    });

    // Crear equipos según el algoritmo seleccionado
    let teamAMembers: Member[] = [];
    let teamBMembers: Member[] = [];

    if (mode === 'manual' && teamA && teamB) {
      // Modo manual: usar equipos proporcionados
      console.log('🎯 Modo manual: usando equipos proporcionados');

      teamAMembers = teamA
        .map((playerId: string) => members.find((m) => m.id === playerId))
        .filter(Boolean);

      teamBMembers = teamB
        .map((playerId: string) => members.find((m) => m.id === playerId))
        .filter(Boolean);
    } else {
      // Modo automático: usar el nuevo algoritmo unificado
      console.log('🎯 Modo automático: usando algoritmo unificado de balance');

      if (useRandomAlgorithm) {
        console.log('🎲 Usando algoritmo completamente aleatorio');
        [teamAMembers, teamBMembers] = createRandomTeams(members);
      } else {
        console.log('🎯 Usando nuevo algoritmo unificado');
        console.log(
          `⚙️ Opciones: edad=${balanceByAge}, rating=${balanceByRating}, posición=${balanceByRole}`
        );

        [teamAMembers, teamBMembers] = createUnifiedBalancedTeams(members, {
          balanceByAge,
          balanceByRating,
          balanceByRole,
        });
      }
    }

    // Asegurar distribución pareja de jugadores reales
    [teamAMembers, teamBMembers] = ensureEvenRealPlayerDistribution(
      teamAMembers,
      teamBMembers
    );

    // Remover duplicados
    let finalTeamA = removeDuplicates(teamAMembers);
    let finalTeamB = removeDuplicates(teamBMembers);

    // Verificar equipos finales
    verifyFinalTeams(finalTeamA, finalTeamB);

    // Calcular edades promedio (redondeado hacia abajo)
    const teamAAvgAge = Math.floor(calculateAverageAge(finalTeamA));
    const teamBAvgAge = Math.floor(calculateAverageAge(finalTeamB));

    // Preparar datos de TBD players y roles
    const requiredPlayersPerTeam = 11;
    const playerRolesMap: Record<string, any[]> = {};
    const assignedRolesMap: Record<string, string> = {};

    [...finalTeamA, ...finalTeamB].forEach((player) => {
      // Usar los roles del jugador si existen
      if (player.playerRoles && Array.isArray(player.playerRoles)) {
        playerRolesMap[player.id] = player.playerRoles.map((role: any) => {
          if (typeof role === 'string') {
            return { role, priority: 1 }; // Si es string, convertir a formato PlayerRole
          }
          return role; // Mantener el objeto PlayerRole completo
        });
      } else {
        playerRolesMap[player.id] = [];
      }

      if (player.assignedRole) {
        assignedRolesMap[player.id] = player.assignedRole;
      }
    });

    // Generar jugadores TBD SOLO si realmente es necesario
    // Si ya tenemos jugadores suficientes en total, no crear TBD
    const totalRealPlayers = finalTeamA.length + finalTeamB.length;
    const shouldCreateTbdPlayers =
      allowTbdPlayers && totalRealPlayers < requiredPlayersPerTeam * 2;

    console.log(`🤖 Evaluando TBD players:`, {
      allowTbdPlayers,
      totalRealPlayers,
      requiredTotal: requiredPlayersPerTeam * 2,
      shouldCreateTbdPlayers,
      teamASize: finalTeamA.length,
      teamBSize: finalTeamB.length,
    });

    const tbdPlayersTeamA = shouldCreateTbdPlayers
      ? addTbdPlayers(finalTeamA, true, requiredPlayersPerTeam)
      : [];
    const tbdPlayersTeamB = shouldCreateTbdPlayers
      ? addTbdPlayers(finalTeamB, false, requiredPlayersPerTeam)
      : [];

    // Preparar datos completos de TBD
    const tbdPlayers = {
      teamA: tbdPlayersTeamA,
      teamB: tbdPlayersTeamB,
      playerRoles: playerRolesMap,
      assignedRoles: assignedRolesMap,
    };

    // Crear nombres de equipos
    const teamAName = `Equipo A`;
    const teamBName = `Equipo B`;

    // Ordenar equipos por posición
    const sortedTeamA = sortPlayersByRole(finalTeamA as any);
    const sortedTeamB = sortPlayersByRole(finalTeamB as any);

    // Mapear los equipos para asegurar que playerRoles se incluyan correctamente en la respuesta
    const responseTeamA = sortedTeamA.map((player: any) => ({
      id: player.id,
      name: player.name,
      avatar: null, // Se puede agregar si existe
      age: player.age,
      starRating: player.starRating,
      playerRoles:
        player.playerRoles?.map((role: string) => ({
          role,
          priority: 1,
        })) || [], // Convertir a PlayerRole
      assignedRole: player.assignedRole,
      role: player.role,
      positionForced: player.positionForced || false,
      isTeamA: true,
    }));

    const responseTeamB = sortedTeamB.map((player: any) => ({
      id: player.id,
      name: player.name,
      avatar: null, // Se puede agregar si existe
      age: player.age,
      starRating: player.starRating,
      playerRoles:
        player.playerRoles?.map((role: string) => ({
          role,
          priority: 1,
        })) || [], // Convertir a PlayerRole
      assignedRole: player.assignedRole,
      role: player.role,
      positionForced: player.positionForced || false,
      isTeamA: false,
    }));

    // Crear o actualizar partido
    let match;
    const matchDate = date ? new Date(date) : new Date();
    const matchLocation = location || 'Por definir';

    if (isResort && existingMatch) {
      // Capturar equipos anteriores antes de eliminarlos
      const previousTeamAPlayers = await prisma.matchPlayer.findMany({
        where: {
          matchId: existingMatch.id,
          isTeamA: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const previousTeamBPlayers = await prisma.matchPlayer.findMany({
        where: {
          matchId: existingMatch.id,
          isTeamA: false,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Preparar equipos anteriores para el log
      previousTeams = {
        teamA: previousTeamAPlayers.map(
          (player: { userId: string; user: { name: string | null } }) => ({
            id: player.userId,
            name: player.user.name || 'Jugador',
            role: 'N/A',
          })
        ),
        teamB: previousTeamBPlayers.map(
          (player: { userId: string; user: { name: string | null } }) => ({
            id: player.userId,
            name: player.user.name || 'Jugador',
            role: 'N/A',
          })
        ),
      };

      // Eliminar jugadores actuales
      await prisma.matchPlayer.deleteMany({
        where: { matchId: existingMatch.id },
      });

      // Actualizar partido existente (preservar playerRoles)
      match = await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          teamA: teamAName,
          teamB: teamBName,
          tbdPlayers: JSON.stringify(tbdPlayers),

          sortCount: { increment: 1 },
        },
      });

      console.log('✅ Partido actualizado para re-sorteo');
    } else {
      // Crear nuevo partido (incluir playerRoles si vienen del partido original)
      match = await prisma.match.create({
        data: {
          date: matchDate,
          location: matchLocation,
          groupId,
          teamA: JSON.stringify(responseTeamA), // Guardar el equipo completo
          teamB: JSON.stringify(responseTeamB), // Guardar el equipo completo
          scoreA: 0,
          scoreB: 0,
          status: 'PENDING',
          tbdPlayers: JSON.stringify(tbdPlayers),
          sortCount: 0,
        },
      });

      // Actualizar grupo
      await prisma.group.update({
        where: { id: groupId },
        data: {
          totalMatches: { increment: 1 },
          nextMatch: matchDate,
        },
      });

      console.log('✅ Nuevo partido creado');
    }

    // Registrar jugadores en el partido
    for (const player of finalTeamA) {
      if (!player.id || player.id.startsWith('tbd-')) continue;

      try {
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: player.id,
            isTeamA: true,
          },
        });
      } catch (error) {
        console.error(
          `Error registering player ${player.id} to team A:`,
          error
        );
      }
    }

    for (const player of finalTeamB) {
      if (!player.id || player.id.startsWith('tbd-')) continue;

      try {
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: player.id,
            isTeamA: false,
          },
        });
      } catch (error) {
        console.error(
          `Error registering player ${player.id} to team B:`,
          error
        );
      }
    }

    // Determinar si es realmente un re-sorteo (no el primer sorteo)
    const isActualResort =
      isResort && existingMatch && existingMatch.sortCount > 0;

    // Registrar evento en logs
    await logGroupEvent(
      groupId,
      userId,
      isActualResort ? LogAction.TEAM_RESORTED : LogAction.TEAM_SORTED,
      {
        matchId: match.id,
        matchDate: matchDate,
        matchLocation: matchLocation,
        teamAName: teamAName,
        teamBName: teamBName,
        newTeams: {
          teamA: responseTeamA,
          teamB: responseTeamB,
        },
        totalPlayers: finalTeamA.length + finalTeamB.length,
        tbdPlayersCount: tbdPlayersTeamA.length + tbdPlayersTeamB.length,
        balancingCriteria: {
          byAge: balanceByAge,
          byRole: balanceByRole,
          byRating: balanceByRating,
        },
        ...(isActualResort && { previousTeams }),
      }
    );

    console.log(
      `✅ ${
        isResort ? 'Re-sorteo' : 'Creación'
      } de partido completado exitosamente`
    );

    // Limpiar respuesta - eliminar playerRoles innecesarios
    const cleanMatch = {
      id: match.id,
      date: match.date,
      location: match.location,
      groupId: match.groupId,
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      sortCount: match.sortCount,
    };

    // Limpiar tbdPlayers - eliminar playerRoles de jugadores TBD y sección general
    const cleanTbdPlayers = {
      teamA: tbdPlayers.teamA.map((player: any) => ({
        id: player.id,
        name: player.name,
        isTeamA: player.isTeamA,
        avatar: player.avatar,
        playerType: player.playerType,
      })),
      teamB: tbdPlayers.teamB.map((player: any) => ({
        id: player.id,
        name: player.name,
        isTeamA: player.isTeamA,
        avatar: player.avatar,
        playerType: player.playerType,
      })),
    };

    return res.status(200).json({
      message: isResort
        ? 'Equipos reorganizados correctamente'
        : 'Partido creado correctamente',
      teamA: responseTeamA,
      teamB: responseTeamB,
      teamAAvgAge,
      teamBAvgAge,
      match: cleanMatch,
      tbdPlayers: cleanTbdPlayers,
    });
  } catch (error) {
    console.error('Error al crear partido:', error);
    return res.status(500).json({
      message: 'Error al crear el partido',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
