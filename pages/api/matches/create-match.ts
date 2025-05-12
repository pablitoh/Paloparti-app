import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';
import { logGroupEvent } from '../../../utils/serverLogEvents';
import { LogAction } from '../../../utils/logTypes';

// Interfaces tipo Member
type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: string;
  playerRoles?: string[]; // Roles elegidos por el usuario
  assignedRole?: string; // Rol asignado para la formación
};

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType: 'TBD';
  playerRoles?: string[]; // Roles del jugador
}

// Interfaz para solicitud de crear equipos
interface TeamFormationRequest {
  groupId: string;
  matchId?: string;
  mode: 'manual' | 'auto';
  players?: Array<{
    userId: string;
    name?: string;
    isTeamA: boolean;
    isPlaceholder: boolean;
    playerRoles?: string[]; // Roles del jugador
  }>;
  balanceByAge?: boolean;
  balanceByRole?: boolean; // Nuevo parámetro para equilibrar por rol
  tbdPlayers?: {
    teamA: TbdPlayer[];
    teamB: TbdPlayer[];
  };
  isResort?: boolean;
  forceNewShuffle?: boolean;
}

// Constantes para roles de jugadores (mantener igual que en el frontend)
const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

// Valores de prioridad para roles (menor número = mayor prioridad)
const ROLE_PRIORITY = {
  [PLAYER_ROLES.GOALKEEPER]: 0,
  [PLAYER_ROLES.DEFENDER]: 1,
  [PLAYER_ROLES.MIDFIELDER]: 2,
  [PLAYER_ROLES.FORWARD]: 3,
  [PLAYER_ROLES.WILDCARD]: 4,
};

// Agregar constantes para la formación 4-3-3
const FORMATION = {
  GOALKEEPER: 1,
  DEFENDERS: 4,
  MIDFIELDERS: 3,
  FORWARDS: 3,
};

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (playerRoles?: string[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Encontrar el rol con la prioridad más alta (número más bajo tiene mayor prioridad)
  return playerRoles.reduce((primaryRole, currentRole) => {
    const primaryPriority = ROLE_PRIORITY[primaryRole] ?? 999;
    const currentPriority = ROLE_PRIORITY[currentRole] ?? 999;
    return currentPriority < primaryPriority ? currentRole : primaryRole;
  }, playerRoles[0]);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  // Sólo permitir método POST para este endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const {
      groupId,
      date,
      location,
      balanceByAge = false,
      teamA = null,
      teamB = null,
      mode = 'auto', // 'auto' para sorteo automático, 'manual' para equipos manuales
      matchId = null, // ID del partido existente (para resort)
      isResort = false, // Indica si es un re-sorteo de un partido existente
      players = [], // Lista de jugadores proporcionada para el sorteo
      tbdPlayersInput = { teamA: [], teamB: [] }, // Jugadores TBD predefinidos
    } = req.body;

    // Validar campos requeridos
    if (!groupId) {
      return res.status(400).json({ message: 'Se requiere el ID del grupo' });
    }

    // Verificar si el usuario es administrador del grupo
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

    // Si es un re-sorteo, verificar que el partido existe
    let existingMatch = null;
    let previousTeams = null; // Declarar aquí para poder usarlo más tarde

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

      // Obtener información de los equipos actuales ANTES de recalcularlos
      const previousMatchPlayers = await prisma.matchPlayer.findMany({
        where: { matchId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      previousTeams = {
        teamA: previousMatchPlayers
          .filter((p: { isTeamA: boolean }) => p.isTeamA)
          .map((p: { userId: string; user: { name: string | null } }) => ({
            id: p.userId,
            name: p.user.name,
          })),
        teamB: previousMatchPlayers
          .filter((p: { isTeamA: boolean }) => !p.isTeamA)
          .map((p: { userId: string; user: { name: string | null } }) => ({
            id: p.userId,
            name: p.user.name,
          })),
      };

      // Obtener todos los usuarios con asistencia CONFIRMED para este partido
      const attendancesWithUser = await prisma.matchAttendance.findMany({
        where: {
          matchId: existingMatch ? existingMatch.id : 'new-match',
          status: 'CONFIRMED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              birthdate: true, // Asegurarse de incluir birthdate
            },
          },
        },
      });
    } else if (!isResort) {
      // Si no es un re-sorteo, verificar que no existe un partido pendiente
      try {
        // Obtener todos los partidos del grupo y filtrar por status
        const existingMatches = await prisma.match.findMany({
          where: {
            groupId,
            status: 'PENDING',
          },
        });

        if (existingMatches.length > 0) {
          return res.status(400).json({
            message:
              'Ya existe un partido pendiente para este grupo. Finaliza el partido actual antes de crear uno nuevo.',
          });
        }
      } catch (error) {
        console.error('Error al verificar partidos existentes:', error);
        // Continuar con la ejecución si hay un error en la verificación
      }
    }

    // Obtener el grupo para acceder a nombres de equipos personalizados
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        teamAName: true,
        teamBName: true,
        totalMatches: true,
        requiredPlayers: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Comprobar si tenemos suficientes jugadores confirmados
    if (mode === 'auto' && players.length < 2) {
      // Obtenemos los miembros del grupo solo si no se proporcionaron jugadores
      const confirmedMembers = await prisma.matchPlayer.findMany({
        where: {
          matchId,
          match: {
            groupId,
          },
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

      if (confirmedMembers.length < 2) {
        return res.status(400).json({
          message:
            'Se necesitan al menos 2 jugadores confirmados para formar equipos',
        });
      }
    }

    // Usar nombres de equipos personalizados o por defecto
    const teamAName = group.teamAName ? `${group.teamAName}` : `Equipo A`;
    const teamBName = group.teamBName ? `${group.teamBName}` : `Equipo B`;
    const requiredPlayersPerTeam = Math.ceil(group.requiredPlayers / 2) || 5;

    // Usar valores existentes si es un re-sorteo, o los proporcionados/default si es uno nuevo
    const matchDate =
      isResort && existingMatch
        ? existingMatch.date
        : date
        ? new Date(date)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día en el futuro por defecto

    const matchLocation =
      isResort && existingMatch
        ? existingMatch.location
        : location || 'Ubicación por definir';

    // Crear equipos según el modo (auto o manual)
    let finalTeamA: any[] = [];
    let finalTeamB: any[] = [];
    let teamAAvgAge = 0;
    let teamBAvgAge = 0;

    if (mode === 'manual' && teamA && teamB) {
      // Modo manual: usar los equipos proporcionados
      finalTeamA = teamA;
      finalTeamB = teamB;
    } else {
      // Modo automático: sortear equipos
      console.log(
        'Sorteando equipos para',
        players.length,
        'jugadores confirmados'
      );

      // Si se proporcionaron jugadores en la solicitud, usarlos para el sorteo
      let mappedMembers: Member[] = [];

      if (players && players.length > 0) {
        // Usar los jugadores proporcionados en la solicitud
        mappedMembers = players.map((player: any) => ({
          id: player.userId,
          name: player.name || 'Jugador',
          birthdate: null,
          age: 30, // Valor por defecto
          role: 'MEMBER',
          playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD], // Asegurarnos de transferir los roles proporcionados
        }));
      } else if (isResort && matchId) {
        // Si es un resorteo, obtener TODOS los jugadores confirmados de asistencia, incluyendo los ya asignados a equipos
        try {
          const confirmedAttendance = await prisma.matchAttendance.findMany({
            where: {
              matchId,
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

          // Obtener los roles de los jugadores desde el match
          const matchData = await prisma.match.findUnique({
            where: { id: matchId },
            select: { tbdPlayers: true },
          });

          let playerRoles: Record<string, string[]> = {};
          if (matchData?.tbdPlayers) {
            const tbdPlayers =
              typeof matchData.tbdPlayers === 'string'
                ? JSON.parse(matchData.tbdPlayers as string)
                : matchData.tbdPlayers;

            if (
              tbdPlayers.playerRoles &&
              typeof tbdPlayers.playerRoles === 'object'
            ) {
              playerRoles = tbdPlayers.playerRoles as Record<string, string[]>;
            }
          }

          mappedMembers = confirmedAttendance.map(
            (attendance: {
              user: {
                id: string;
                name: string | null;
                birthdate: Date | null;
              };
            }) => ({
              id: attendance.user.id,
              name: attendance.user.name,
              birthdate: attendance.user.birthdate,
              age:
                calculateAge(attendance.user.birthdate) ||
                Math.floor(Math.random() * 40) + 18,
              role: 'MEMBER',
              // Obtener los roles del jugador si existen
              playerRoles: playerRoles[attendance.user.id] || [],
            })
          );

          console.log(
            `Obtenidos ${mappedMembers.length} jugadores confirmados para el sorteo`
          );
        } catch (error) {
          console.error('Error al obtener jugadores confirmados:', error);
        }
      } else {
        // FALLBACK: Si no se proporcionaron jugadores, obtener los que confirmaron asistencia
        // Esto debería ejecutarse solo como respaldo
        const confirmedAttendees = await prisma.$queryRaw<
          Array<{ userId: string }>
        >`
          SELECT "userId" FROM "GroupMember"
          WHERE "groupId" = ${groupId}
          AND "status" = 'CONFIRMED'
        `;

        // Extraer solo los IDs de usuarios que han confirmado asistencia
        const confirmedUserIds = confirmedAttendees.map(
          (attendee: { userId: string }) => attendee.userId
        );

        // Obtener los datos básicos de esos usuarios
        const usersData = await prisma.user.findMany({
          where: {
            id: {
              in: confirmedUserIds,
            },
          },
          select: {
            id: true,
            name: true,
            birthdate: true,
          },
        });

        // Mapear los datos de usuarios
        mappedMembers = usersData.map(
          (user: {
            id: string;
            name: string | null;
            birthdate: Date | null;
          }) => ({
            id: user.id,
            name: user.name,
            birthdate: user.birthdate,
            age:
              calculateAge(user.birthdate) ||
              Math.floor(Math.random() * 40) + 18,
            role: 'MEMBER',
          })
        );
      }

      // Añadir logs para depuración antes de clasificar jugadores
      console.log(
        'Jugadores antes de formar equipos:',
        mappedMembers.map((m) => ({
          id: m.id,
          name: m.name,
          playerRoles: m.playerRoles,
        }))
      );

      // Función para balancear equipos por edad
      const createBalancedTeams = (members: Member[]): [Member[], Member[]] => {
        // Ordenar miembros por edad, de mayor a menor
        const sortedMembers = [...members].sort((a, b) => {
          const ageA = a.age || 30; // Valor por defecto si no hay edad
          const ageB = b.age || 30;
          return ageB - ageA; // De mayor a menor
        });

        const teamA: Member[] = [];
        const teamB: Member[] = [];

        // Distribuir alternadamente los jugadores para balancear edades
        sortedMembers.forEach((member, index) => {
          if (index % 2 === 0) {
            teamA.push(member);
          } else {
            teamB.push(member);
          }
        });

        return [teamA, teamB];
      };

      // Función para balancear equipos por rol
      const createRoleBalancedTeams = (
        members: Member[]
      ): [Member[], Member[]] => {
        let teamA: Member[] = [];
        let teamB: Member[] = [];

        // Separar jugadores por su rol principal
        const playersByRole: Record<string, Member[]> = {};

        // Jugadores sin rol asignado
        const playersWithoutRole: Member[] = [];

        // Clasificar jugadores por rol
        members.forEach((member) => {
          const primaryRole = getPrimaryRole(member.playerRoles);
          if (primaryRole) {
            if (!playersByRole[primaryRole]) {
              playersByRole[primaryRole] = [];
            }
            playersByRole[primaryRole].push(member);
          } else {
            playersWithoutRole.push(member);
          }
        });

        // Distribuir arqueros (más importantes)
        const goalkeepers = playersByRole[PLAYER_ROLES.GOALKEEPER] || [];
        if (goalkeepers.length >= 2) {
          // Si hay al menos 2 arqueros, distribuir uno a cada equipo
          const sortedGoalkeepers = [...goalkeepers].sort(
            () => Math.random() - 0.5
          );
          teamA.push({
            ...sortedGoalkeepers[0],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          teamB.push({
            ...sortedGoalkeepers[1],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });

          // Si hay más arqueros, añadirlos a la lista de sin rol para distribuirlos después
          if (goalkeepers.length > 2) {
            playersWithoutRole.push(...sortedGoalkeepers.slice(2));
          }
        } else if (goalkeepers.length === 1) {
          // Si solo hay un arquero, usar una moneda para decidir a qué equipo va
          if (Math.random() > 0.5) {
            teamA.push({
              ...goalkeepers[0],
              assignedRole: PLAYER_ROLES.GOALKEEPER,
            });
          } else {
            teamB.push({
              ...goalkeepers[0],
              assignedRole: PLAYER_ROLES.GOALKEEPER,
            });
          }
        }

        // Distribuir defensores
        const defenders = playersByRole[PLAYER_ROLES.DEFENDER] || [];
        const sortedDefenders = [...defenders].sort(() => Math.random() - 0.5);

        // Asegurarnos de que no tomamos más jugadores de los que hay disponibles
        const defenderCount = Math.min(
          sortedDefenders.length,
          FORMATION.DEFENDERS * 2
        );
        const perTeamDefenders = Math.floor(defenderCount / 2);

        // Asignar defensores de manera equilibrada
        const teamADefenders = sortedDefenders.slice(0, perTeamDefenders);
        const teamBDefenders = sortedDefenders.slice(
          perTeamDefenders,
          defenderCount
        );

        // Asignar rol de defensor a los seleccionados
        teamA.push(
          ...teamADefenders.map((defender) => ({
            ...defender,
            assignedRole: PLAYER_ROLES.DEFENDER,
          }))
        );
        teamB.push(
          ...teamBDefenders.map((defender) => ({
            ...defender,
            assignedRole: PLAYER_ROLES.DEFENDER,
          }))
        );

        // Si quedan defensores, añadirlos a sin rol
        if (sortedDefenders.length > defenderCount) {
          playersWithoutRole.push(...sortedDefenders.slice(defenderCount));
        }

        // Distribuir mediocampistas
        const midfielders = playersByRole[PLAYER_ROLES.MIDFIELDER] || [];
        const sortedMidfielders = [...midfielders].sort(
          () => Math.random() - 0.5
        );

        // Asegurarnos de que no tomamos más jugadores de los que hay disponibles
        const midfielderCount = Math.min(
          sortedMidfielders.length,
          FORMATION.MIDFIELDERS * 2
        );
        const perTeamMidfielders = Math.floor(midfielderCount / 2);

        // Asignar mediocampistas de manera equilibrada
        const teamAMidfielders = sortedMidfielders.slice(0, perTeamMidfielders);
        const teamBMidfielders = sortedMidfielders.slice(
          perTeamMidfielders,
          midfielderCount
        );

        // Asignar rol de mediocampista a los seleccionados
        teamA.push(
          ...teamAMidfielders.map((mid) => ({
            ...mid,
            assignedRole: PLAYER_ROLES.MIDFIELDER,
          }))
        );
        teamB.push(
          ...teamBMidfielders.map((mid) => ({
            ...mid,
            assignedRole: PLAYER_ROLES.MIDFIELDER,
          }))
        );

        // Si quedan mediocampistas, añadirlos a sin rol
        if (sortedMidfielders.length > midfielderCount) {
          playersWithoutRole.push(...sortedMidfielders.slice(midfielderCount));
        }

        // Distribuir delanteros
        const forwards = playersByRole[PLAYER_ROLES.FORWARD] || [];
        const sortedForwards = [...forwards].sort(() => Math.random() - 0.5);

        // Asegurarnos de que no tomamos más jugadores de los que hay disponibles
        const forwardCount = Math.min(
          sortedForwards.length,
          FORMATION.FORWARDS * 2
        );
        const perTeamForwards = Math.floor(forwardCount / 2);

        // Asignar delanteros de manera equilibrada
        const teamAForwards = sortedForwards.slice(0, perTeamForwards);
        const teamBForwards = sortedForwards.slice(
          perTeamForwards,
          forwardCount
        );

        // Asignar rol de delantero a los seleccionados
        teamA.push(
          ...teamAForwards.map((forward) => ({
            ...forward,
            assignedRole: PLAYER_ROLES.FORWARD,
          }))
        );
        teamB.push(
          ...teamBForwards.map((forward) => ({
            ...forward,
            assignedRole: PLAYER_ROLES.FORWARD,
          }))
        );

        // Si quedan delanteros, añadirlos a sin rol
        if (sortedForwards.length > forwardCount) {
          playersWithoutRole.push(...sortedForwards.slice(forwardCount));
        }

        // Distribuir comodines y jugadores sobrantes
        // Combinar comodines con jugadores sin rol
        const wildcards = playersByRole[PLAYER_ROLES.WILDCARD] || [];
        const remainingPlayers = [...playersWithoutRole, ...wildcards];
        const sortedRemaining = [...remainingPlayers].sort(
          () => Math.random() - 0.5
        );

        // SOLUCIÓN AL BUG: Dividir los jugadores restantes antes de asignarlos
        // Dividir jugadores restantes en dos grupos equilibrados
        const remainingTeamA: Member[] = [];
        const remainingTeamB: Member[] = [];

        // Distribuir jugadores restantes alternando entre equipos
        sortedRemaining.forEach((player, index) => {
          if (index % 2 === 0) {
            remainingTeamA.push(player);
          } else {
            remainingTeamB.push(player);
          }
        });

        // Función para asignar jugadores restantes a posiciones que faltan
        const assignRemainingPlayers = (
          team: Member[],
          remainingPool: Member[],
          isTeamA: boolean
        ) => {
          // Contar cuántos jugadores hay por posición
          const positionCounts = {
            [PLAYER_ROLES.GOALKEEPER]: team.filter(
              (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
            ).length,
            [PLAYER_ROLES.DEFENDER]: team.filter(
              (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
            ).length,
            [PLAYER_ROLES.MIDFIELDER]: team.filter(
              (p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER
            ).length,
            [PLAYER_ROLES.FORWARD]: team.filter(
              (p) => p.assignedRole === PLAYER_ROLES.FORWARD
            ).length,
          };

          const result = [...team]; // Crear copia para no modificar el original

          // Asignar jugadores a posiciones faltantes, de atrás hacia adelante
          while (
            remainingPool.length > 0 &&
            (positionCounts[PLAYER_ROLES.GOALKEEPER] < FORMATION.GOALKEEPER ||
              positionCounts[PLAYER_ROLES.DEFENDER] < FORMATION.DEFENDERS ||
              positionCounts[PLAYER_ROLES.MIDFIELDER] < FORMATION.MIDFIELDERS ||
              positionCounts[PLAYER_ROLES.FORWARD] < FORMATION.FORWARDS)
          ) {
            const player = remainingPool.shift();
            if (!player) break;

            // Asignar al jugador a la primera posición que falte (de atrás hacia adelante)
            if (
              positionCounts[PLAYER_ROLES.GOALKEEPER] < FORMATION.GOALKEEPER
            ) {
              result.push({ ...player, assignedRole: PLAYER_ROLES.GOALKEEPER });
              positionCounts[PLAYER_ROLES.GOALKEEPER]++;
            } else if (
              positionCounts[PLAYER_ROLES.DEFENDER] < FORMATION.DEFENDERS
            ) {
              result.push({ ...player, assignedRole: PLAYER_ROLES.DEFENDER });
              positionCounts[PLAYER_ROLES.DEFENDER]++;
            } else if (
              positionCounts[PLAYER_ROLES.MIDFIELDER] < FORMATION.MIDFIELDERS
            ) {
              result.push({ ...player, assignedRole: PLAYER_ROLES.MIDFIELDER });
              positionCounts[PLAYER_ROLES.MIDFIELDER]++;
            } else if (
              positionCounts[PLAYER_ROLES.FORWARD] < FORMATION.FORWARDS
            ) {
              result.push({ ...player, assignedRole: PLAYER_ROLES.FORWARD });
              positionCounts[PLAYER_ROLES.FORWARD]++;
            }
          }

          // Asignar cualquier jugador sobrante al rol con menos jugadores
          while (remainingPool.length > 0) {
            const player = remainingPool.shift();
            if (!player) break;

            // Decidir qué rol asignar (usar el que tenga menos jugadores)
            const positionCounts = {
              [PLAYER_ROLES.DEFENDER]: result.filter(
                (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
              ).length,
              [PLAYER_ROLES.MIDFIELDER]: result.filter(
                (p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER
              ).length,
              [PLAYER_ROLES.FORWARD]: result.filter(
                (p) => p.assignedRole === PLAYER_ROLES.FORWARD
              ).length,
            };

            // Encontrar la posición con menos jugadores (excluyendo arquero)
            let assignRole = PLAYER_ROLES.WILDCARD;
            let minCount = Infinity;

            for (const [role, count] of Object.entries(positionCounts)) {
              if (count < minCount) {
                minCount = count;
                assignRole = role;
              }
            }

            result.push({ ...player, assignedRole: assignRole });
          }

          return result;
        };

        // Asignar jugadores restantes a ambos equipos, usando grupos separados
        teamA = assignRemainingPlayers(teamA, remainingTeamA, true);
        teamB = assignRemainingPlayers(teamB, remainingTeamB, false);

        // ASEGURAR BALANCE FINAL EN CANTIDAD DE JUGADORES
        // Si hay desbalance después de distribuir por roles, corregirlo
        if (Math.abs(teamA.length - teamB.length) > 1) {
          console.log(
            `Desbalance detectado: Equipo A (${teamA.length}) vs Equipo B (${teamB.length})`
          );

          // Determinar qué equipo tiene más jugadores
          let sourceTeam = teamA.length > teamB.length ? teamA : teamB;
          let targetTeam = teamA.length > teamB.length ? teamB : teamA;

          // Calcular cuántos jugadores hay que mover
          const playersToMove = Math.floor(
            Math.abs(teamA.length - teamB.length) / 2
          );
          console.log(`Moviendo ${playersToMove} jugadores para equilibrar`);

          // Mover jugadores para equilibrar
          for (let i = 0; i < playersToMove; i++) {
            // Preferir mover jugadores con rol WILDCARD o de posiciones con exceso
            const roleCount = {
              [PLAYER_ROLES.GOALKEEPER]: sourceTeam.filter(
                (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
              ).length,
              [PLAYER_ROLES.DEFENDER]: sourceTeam.filter(
                (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
              ).length,
              [PLAYER_ROLES.MIDFIELDER]: sourceTeam.filter(
                (p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER
              ).length,
              [PLAYER_ROLES.FORWARD]: sourceTeam.filter(
                (p) => p.assignedRole === PLAYER_ROLES.FORWARD
              ).length,
              [PLAYER_ROLES.WILDCARD]: sourceTeam.filter(
                (p) => p.assignedRole === PLAYER_ROLES.WILDCARD
              ).length,
            };

            // Determinar qué rol tiene más jugadores para mover de ahí
            let roleToMove = PLAYER_ROLES.WILDCARD;
            let maxCount = 0;

            for (const [role, count] of Object.entries(roleCount)) {
              // Evitar mover arqueros si es posible
              if (role === PLAYER_ROLES.GOALKEEPER && count <= 1) continue;

              if (count > maxCount) {
                maxCount = count;
                roleToMove = role;
              }
            }

            // Encontrar un jugador para mover
            const playerIndex = sourceTeam.findIndex(
              (p) => p.assignedRole === roleToMove
            );
            if (playerIndex !== -1) {
              const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
              targetTeam.push(playerToMove);
            }
          }

          console.log(
            `Balance final: Equipo A (${teamA.length}) vs Equipo B (${teamB.length})`
          );
        }

        // En la función createRoleBalancedTeams, después de clasificar jugadores por rol
        // Añadir estos logs después de la clasificación:
        const logRolesDistribution = () => {
          console.log('Distribución de jugadores por rol:');
          Object.values(PLAYER_ROLES).forEach((roleName) => {
            console.log(
              `${roleName}: ${playersByRole[roleName]?.length || 0} jugadores`
            );
          });
          console.log(
            `Sin rol asignado: ${playersWithoutRole.length} jugadores`
          );
        };

        logRolesDistribution();

        return [teamA, teamB];
      };

      // Crear equipos aleatorios si no se requiere balanceo por edad o rol
      const createRandomTeams = (members: Member[]): [Member[], Member[]] => {
        // Implementación del algoritmo Fisher-Yates para mezcla más robusta
        const shuffleArray = (array: Member[]): Member[] => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        // Realizar varias pasadas de mezcla con diferentes semillas
        let shuffledMembers = [...members];

        // Usar tiempo actual + número aleatorio como semilla
        const seed = Date.now() + Math.random() * 10000;

        // Primera pasada de mezcla
        shuffledMembers = shuffleArray(shuffledMembers);

        // Añadir una semilla diferente y volver a mezclar
        Math.random();
        Math.random(); // Descartar algunos números aleatorios
        shuffledMembers = shuffleArray(shuffledMembers);

        // Dividir en dos equipos
        const halfIndex = Math.ceil(shuffledMembers.length / 2);
        const teamA = shuffledMembers.slice(0, halfIndex);
        const teamB = shuffledMembers.slice(halfIndex);

        return [teamA, teamB];
      };

      // Determinar el método de creación de equipos según los parámetros
      let autoTeamA: Member[] = [];
      let autoTeamB: Member[] = [];

      // Realizar hasta 5 intentos para asegurar que los equipos cambien en un resorteo
      let maxAttempts = 5;
      let teamsChanged = !isResort; // Si no es resorteo, no necesitamos verificar cambios

      // Verificar si el balanceo por rol está activado
      const balanceByRole = req.body.balanceByRole !== false; // Por defecto true si no se especifica

      while (!teamsChanged && maxAttempts > 0) {
        // Priorizar el balanceo por rol sobre el balanceo por edad
        if (balanceByRole) {
          [autoTeamA, autoTeamB] = createRoleBalancedTeams(mappedMembers);
        } else if (balanceByAge) {
          [autoTeamA, autoTeamB] = createBalancedTeams(mappedMembers);
        } else {
          [autoTeamA, autoTeamB] = createRandomTeams(mappedMembers);
        }

        // Verificar si los equipos han cambiado (solo para resorteo)
        if (isResort) {
          const newTeamAIds = autoTeamA.map((p) => p.id);
          const newTeamBIds = autoTeamB.map((p) => p.id);

          // Calcular cuántos jugadores cambiaron de equipo
          let teamAChanges = 0;
          let teamBChanges = 0;

          if (previousTeams) {
            teamAChanges = newTeamAIds.filter((id) =>
              previousTeams.teamB.some(
                (player: { id: string }) => player.id === id
              )
            ).length;
            teamBChanges = newTeamBIds.filter((id) =>
              previousTeams.teamA.some(
                (player: { id: string }) => player.id === id
              )
            ).length;
          }

          // Consideramos que los equipos cambiaron si al menos un 25% de jugadores cambió de equipo
          const minChangeRequired = Math.max(
            1,
            Math.floor(mappedMembers.length * 0.25)
          );
          teamsChanged = teamAChanges + teamBChanges >= minChangeRequired;

          console.log(`Intento ${6 - maxAttempts} de resorteo:`, {
            teamAChanges,
            teamBChanges,
            minChangeRequired,
            teamsChanged,
          });
        } else {
          teamsChanged = true; // No es un resorteo, no verificamos cambios
        }

        maxAttempts--;
      }

      // Calcular edad promedio por equipo
      const calculateAverageAge = (team: Member[]): number => {
        const membersWithAge = team.filter((m) => m.age !== null);
        if (membersWithAge.length === 0) return 0;

        const sum = membersWithAge.reduce(
          (total, member) => total + (member.age || 0),
          0
        );
        return Math.round(sum / membersWithAge.length);
      };

      teamAAvgAge = calculateAverageAge(autoTeamA);
      teamBAvgAge = calculateAverageAge(autoTeamB);

      // Convertir los equipos a un formato compatible con la API
      finalTeamA = autoTeamA.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: null,
        playerType: 'TEAM',
        age: player.age,
        playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD], // Mantener los roles originales del jugador
        assignedRole: player.assignedRole || PLAYER_ROLES.WILDCARD, // Rol asignado para la formación
      }));

      finalTeamB = autoTeamB.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: null,
        playerType: 'TEAM',
        age: player.age,
        playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD], // Mantener los roles originales del jugador
        assignedRole: player.assignedRole || PLAYER_ROLES.WILDCARD, // Rol asignado para la formación
      }));

      // Asegurar que todos los jugadores tengan una edad definida y calcular promedios
      teamAAvgAge = calculateAverageAge(autoTeamA);
      teamBAvgAge = calculateAverageAge(autoTeamB);

      console.log('Equipos formados:', {
        teamAAvgAge,
        teamBAvgAge,
        teamAPlayers: finalTeamA.map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age,
        })),
        teamBPlayers: finalTeamB.map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age,
        })),
      });
    }

    // Añadir jugadores TBD si es necesario
    const addTbdPlayers = (team: any[], isTeamA: boolean) => {
      // Si se proporcionaron jugadores TBD, usarlos
      if (tbdPlayersInput) {
        const tbdForTeam = isTeamA
          ? Array.isArray(tbdPlayersInput.teamA)
            ? tbdPlayersInput.teamA
            : []
          : Array.isArray(tbdPlayersInput.teamB)
          ? tbdPlayersInput.teamB
          : [];

        if (tbdForTeam.length > 0) {
          return tbdForTeam;
        }
      }

      // Fallback: crear jugadores TBD genéricos
      const generatedTbdPlayers: TbdPlayer[] = [];

      // Añadir jugadores TBD hasta completar el número requerido
      while (
        team.length + generatedTbdPlayers.length <
        requiredPlayersPerTeam
      ) {
        generatedTbdPlayers.push({
          id: `tbd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: 'A determinar',
          isTeamA,
          avatar: null,
          playerType: 'TBD',
        });
      }

      return generatedTbdPlayers;
    };

    const tbdPlayersTeamA = addTbdPlayers(finalTeamA, true);
    const tbdPlayersTeamB = addTbdPlayers(finalTeamB, false);

    let match;

    // Crear un objeto para almacenar roles de jugadores
    const playerRolesMap: Record<string, string[]> = {};
    const assignedRolesMap: Record<string, string> = {}; // Nuevo mapa para roles asignados

    // Recopilar roles de todos los jugadores
    for (const player of finalTeamA) {
      // Asegurarnos de preservar los roles originales
      // Primero verificar si los roles vienen de la solicitud original
      const originalPlayer = players?.find(
        (p: { userId: string }) => p.userId === player.id
      );
      if (originalPlayer && originalPlayer.playerRoles) {
        playerRolesMap[player.id] = originalPlayer.playerRoles;
      } else if (player.playerRoles && player.playerRoles.length > 0) {
        playerRolesMap[player.id] = player.playerRoles;
      } else {
        playerRolesMap[player.id] = [PLAYER_ROLES.WILDCARD];
      }

      // Guardar el rol asignado para la formación
      if (player.assignedRole) {
        assignedRolesMap[player.id] = player.assignedRole;
      }
    }

    for (const player of finalTeamB) {
      // Asegurarnos de preservar los roles originales
      // Primero verificar si los roles vienen de la solicitud original
      const originalPlayer = players?.find(
        (p: { userId: string }) => p.userId === player.id
      );
      if (originalPlayer && originalPlayer.playerRoles) {
        playerRolesMap[player.id] = originalPlayer.playerRoles;
      } else if (player.playerRoles && player.playerRoles.length > 0) {
        playerRolesMap[player.id] = player.playerRoles;
      } else {
        playerRolesMap[player.id] = [PLAYER_ROLES.WILDCARD];
      }

      // Guardar el rol asignado para la formación
      if (player.assignedRole) {
        assignedRolesMap[player.id] = player.assignedRole;
      }
    }

    // Preparar los datos para la respuesta
    const tbdPlayers = {
      teamA: tbdPlayersTeamA,
      teamB: tbdPlayersTeamB,
      playerRoles: playerRolesMap, // Todos los roles elegidos
      assignedRoles: assignedRolesMap, // Roles asignados para la formación
    };

    // Si es un re-sorteo, actualizar el partido existente; si no, crear uno nuevo
    if (isResort && existingMatch) {
      // Primero eliminar los jugadores actuales
      await prisma.matchPlayer.deleteMany({
        where: { matchId: existingMatch.id },
      });

      // Actualizar el partido existente
      match = await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          // No actualizamos date ni location en un re-sorteo
          teamA: teamAName,
          teamB: teamBName,
          tbdPlayers: JSON.stringify(tbdPlayers), // Guardar tbdPlayers completo con playerRoles
          sortCount: { increment: 1 },
        },
      });
    } else {
      // Crear un nuevo partido
      match = await prisma.match.create({
        data: {
          date: matchDate,
          location: matchLocation,
          groupId,
          teamA: teamAName,
          teamB: teamBName,
          scoreA: 0,
          scoreB: 0,
          status: 'PENDING',
          tbdPlayers: JSON.stringify(tbdPlayers), // Guardar tbdPlayers completo con playerRoles
          sortCount: 0,
        },
      });

      // Actualizar el grupo con la información del nuevo partido
      await prisma.group.update({
        where: { id: groupId },
        data: {
          totalMatches: { increment: 1 },
          nextMatch: matchDate,
        },
      });
    }

    // Registrar jugadores del equipo A
    for (const player of finalTeamA) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: true,
        },
      });
    }

    // Registrar jugadores del equipo B
    for (const player of finalTeamB) {
      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.id,
          isTeamA: false,
        },
      });
    }

    // Registrar acción en el log
    const logAction = isResort
      ? LogAction.TEAM_RESORTED
      : LogAction.TEAM_SORTED;

    // Preparar los datos para el log
    const logData: any = {
      matchId,
      newTeams: {
        teamA: finalTeamA.map((p: any) => ({
          id: p.userId || p.id,
          name: p.name,
        })),
        teamB: finalTeamB.map((p: any) => ({
          id: p.userId || p.id,
          name: p.name,
        })),
      },
    };

    // Solo incluir equipos anteriores si es un resort y sortCount > 0
    if (isResort && previousTeams) {
      logData.previousTeams = previousTeams;
    }

    // Registrar en logs
    await logGroupEvent(groupId, user.id, logAction, logData);

    // Retornar los equipos formados y el partido creado
    return res.status(200).json({
      message: isResort
        ? 'Equipos reorganizados correctamente'
        : 'Partido creado correctamente',
      teamA: finalTeamA,
      teamB: finalTeamB,
      teamAAvgAge,
      teamBAvgAge,
      match,
      tbdPlayers,
    });
  } catch (error) {
    console.error('Error al crear partido:', error);
    return res.status(500).json({
      message: 'Error al crear el partido',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
