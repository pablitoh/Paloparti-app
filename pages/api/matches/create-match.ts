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
import {
  createUnifiedBalancedTeams,
  createStructuredBalancedTeams,
} from '../../../lib/matches/unifiedBalancer';

// Importar utilidades de partidos
import {
  calculateAverageAge,
  addTbdPlayers,
  verifyFinalTeams,
  removeDuplicates,
  ensureEvenRealPlayerDistribution,
  ensureEvenRealPlayerDistributionRandom,
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
      console.log(
        '🎯 DEBUG - Iniciando re-sorteo con isResort:',
        isResort,
        'matchId:',
        matchId
      );

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
      console.log(
        '🎯 DEBUG - Obteniendo asistencias para re-sorteo del partido:',
        existingMatch.id
      );

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

      console.log(
        '🎯 DEBUG - Jugadores confirmados para re-sorteo:',
        confirmedAttendances.length
      );
    } else {
      console.log('🎯 DEBUG - Obteniendo asistencias para nuevo partido');

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
      '🎯 DEBUG - Total de jugadores confirmados:',
      confirmedAttendances.length
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

    console.log(
      '🎯 DEBUG - Jugadores convertidos a formato Member:',
      members.length
    );
    console.log('🎯 DEBUG - Parámetros de balanceo:', {
      balanceByAge,
      balanceByRole,
      balanceByRating,
      mode,
      useRandomAlgorithm,
    });

    // Crear equipos según el algoritmo seleccionado
    let teamAMembers: Member[] = [];
    let teamBMembers: Member[] = [];

    // Declarar variables que se usarán en toda la función
    let finalTeamA: any[] = [];
    let finalTeamB: any[] = [];
    let teamAAvgAge = 0;
    let teamBAvgAge = 0;
    let tbdPlayers: any = null;
    let lowVariability = false;

    if (mode === 'manual' && teamA && teamB) {
      console.log('🎯 DEBUG - Usando modo manual');
      teamAMembers = teamA
        .map((playerId: string) => members.find((m) => m.id === playerId))
        .filter(Boolean);

      teamBMembers = teamB
        .map((playerId: string) => members.find((m) => m.id === playerId))
        .filter(Boolean);
    } else {
      // === LÓGICA DE REINTENTOS PARA VARIABILIDAD ===
      let maxTries = 10;
      let tries = 0;
      let previousTeamAIds = [];
      let previousTeamBIds = [];

      // Si es resort, obtener los equipos actuales para comparar
      if (
        isResort &&
        existingMatch &&
        existingMatch.teamA &&
        existingMatch.teamB
      ) {
        try {
          previousTeamAIds = JSON.parse(existingMatch.teamA)
            .map((p: any) => p.id)
            .sort();
          previousTeamBIds = JSON.parse(existingMatch.teamB)
            .map((p: any) => p.id)
            .sort();
        } catch (e) {
          previousTeamAIds = [];
          previousTeamBIds = [];
        }
      }

      let foundDifferent = false;
      let lastTeamA = [];
      let lastTeamB = [];
      let lastFinalTeamA = [];
      let lastFinalTeamB = [];
      let lastTeamAAvgAge = 0;
      let lastTeamBAvgAge = 0;
      let lastTbdPlayers = null;
      let lastPlayerRolesMap = null;
      let lastAssignedRolesMap = null;

      while (tries < maxTries && !foundDifferent) {
        // Ejecutar el algoritmo según el modo seleccionado
        let [teamAMembers, teamBMembers] = useRandomAlgorithm
          ? createRandomTeams(members)
          : createStructuredBalancedTeams(
              members,
              {
                balanceByAge,
                balanceByRating,
                balanceByRole,
                addVariability: true,
              },
              // Pasar equipos previos para variabilidad
              previousTeamAIds.length > 0 && previousTeamBIds.length > 0
                ? {
                    teamA: previousTeamAIds,
                    teamB: previousTeamBIds,
                  }
                : undefined
            );

        // Solo aplicar ensureEvenRealPlayerDistribution si es absolutamente necesario
        // y de manera que preserve la variabilidad
        const realPlayersA = teamAMembers.filter(
          (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
        );
        const realPlayersB = teamBMembers.filter(
          (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
        );
        const difference = Math.abs(realPlayersA.length - realPlayersB.length);

        // Solo redistribuir si la diferencia es mayor a 1 y hay equipos previos para comparar
        if (
          difference > 1 &&
          previousTeamAIds.length > 0 &&
          previousTeamBIds.length > 0
        ) {
          console.log(
            `⚠️ Diferencia de ${difference} jugadores detectada, aplicando redistribución aleatoria`
          );

          // Aplicar redistribución de manera aleatoria para preservar variabilidad
          const [newTeamAMembers, newTeamBMembers] =
            ensureEvenRealPlayerDistributionRandom(
              teamAMembers as any,
              teamBMembers as any
            );
          teamAMembers = newTeamAMembers as any;
          teamBMembers = newTeamBMembers as any;
        } else {
          console.log(
            `✅ Distribución equilibrada (diferencia: ${difference}), no se aplica redistribución`
          );
        }

        let tempFinalTeamA = removeDuplicates(teamAMembers);
        let tempFinalTeamB = removeDuplicates(teamBMembers);
        // Ordenar por id para comparar
        const teamAIds = tempFinalTeamA.map((p) => p.id).sort();
        const teamBIds = tempFinalTeamB.map((p) => p.id).sort();
        // Guardar para la respuesta
        lastTeamA = teamAIds;
        lastTeamB = teamBIds;
        lastFinalTeamA = tempFinalTeamA;
        lastFinalTeamB = tempFinalTeamB;
        lastTeamAAvgAge = Math.floor(calculateAverageAge(tempFinalTeamA));
        lastTeamBAvgAge = Math.floor(calculateAverageAge(tempFinalTeamB));
        // TBD players y roles
        const requiredPlayersPerTeam = 11;
        const playerRolesMap: Record<string, any[]> = {};
        const assignedRolesMap: Record<string, string> = {};
        [...tempFinalTeamA, ...tempFinalTeamB].forEach((player) => {
          if (player.playerRoles && Array.isArray(player.playerRoles)) {
            playerRolesMap[player.id] = player.playerRoles.map((role: any) => {
              if (typeof role === 'string') return { role, priority: 1 };
              return role;
            });
          } else {
            playerRolesMap[player.id] = [];
          }
          if (player.assignedRole)
            assignedRolesMap[player.id] = player.assignedRole;
        });
        lastPlayerRolesMap = playerRolesMap;
        lastAssignedRolesMap = assignedRolesMap;
        const totalRealPlayers = tempFinalTeamA.length + tempFinalTeamB.length;
        const shouldCreateTbdPlayers =
          allowTbdPlayers && totalRealPlayers < requiredPlayersPerTeam * 2;
        const tbdPlayersTeamA = shouldCreateTbdPlayers
          ? addTbdPlayers(tempFinalTeamA, true, requiredPlayersPerTeam)
          : [];
        const tbdPlayersTeamB = shouldCreateTbdPlayers
          ? addTbdPlayers(tempFinalTeamB, false, requiredPlayersPerTeam)
          : [];
        lastTbdPlayers = {
          teamA: tbdPlayersTeamA,
          teamB: tbdPlayersTeamB,
          playerRoles: playerRolesMap,
          assignedRoles: assignedRolesMap,
        };
        // Comparar con los equipos anteriores
        if (
          previousTeamAIds.length > 0 &&
          previousTeamBIds.length > 0 &&
          ((JSON.stringify(teamAIds) === JSON.stringify(previousTeamAIds) &&
            JSON.stringify(teamBIds) === JSON.stringify(previousTeamBIds)) ||
            (JSON.stringify(teamAIds) === JSON.stringify(previousTeamBIds) &&
              JSON.stringify(teamBIds) === JSON.stringify(previousTeamAIds)))
        ) {
          tries++;
          continue;
        } else {
          foundDifferent = true;
          break;
        }
      }
      if (
        !foundDifferent &&
        previousTeamAIds.length > 0 &&
        previousTeamBIds.length > 0
      ) {
        lowVariability = true;
      }
      // Usar los últimos equipos generados
      finalTeamA = lastFinalTeamA;
      finalTeamB = lastFinalTeamB;
      teamAAvgAge = lastTeamAAvgAge;
      teamBAvgAge = lastTeamBAvgAge;
      tbdPlayers = lastTbdPlayers;
    }

    // Verificar equipos finales
    verifyFinalTeams(finalTeamA, finalTeamB);

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
        player.playerRoles?.map((role: any) => {
          if (typeof role === 'string') {
            return { role, priority: 1 };
          }
          // Si el rol ya es un objeto { role, priority }, devolverlo plano
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
        }) || [],
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
        player.playerRoles?.map((role: any) => {
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
        }) || [],
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
          teamA: JSON.stringify(responseTeamA), // Guardar el equipo completo
          teamB: JSON.stringify(responseTeamB), // Guardar el equipo completo
          tbdPlayers: JSON.stringify(tbdPlayers),
          sortCount: { increment: 1 },
        },
      });

      console.log('✅ Partido actualizado para re-sorteo');
      console.log('🎯 DEBUG - Equipos guardados en base de datos:', {
        teamA: responseTeamA.map((p) => p.name),
        teamB: responseTeamB.map((p) => p.name),
        sortCount: match.sortCount,
      });
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

    // Registrar jugadores en el partido (tanto para nuevo partido como para resort)
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
        tbdPlayersCount: tbdPlayers.teamA.length + tbdPlayers.teamB.length,
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

    // Guardar los criterios de sorteo utilizados en el grupo
    const sortingCriteria = {
      balanceByAge,
      balanceByRole,
      balanceByRating,
      isRandomMode: useRandomAlgorithm,
      timestamp: new Date().toISOString(),
    };

    await prisma.group.update({
      where: { id: groupId },
      data: {
        lastSortingCriteria: JSON.stringify(sortingCriteria),
      },
    });

    console.log('✅ Criterios de sorteo guardados:', sortingCriteria);

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
      lowVariability,
    });
  } catch (error) {
    console.error('Error al crear partido:', error);
    return res.status(500).json({
      message: 'Error al crear el partido',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
