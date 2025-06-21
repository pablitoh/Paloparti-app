import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';
import { calculateAge } from '../../../lib/utils';
import { logGroupEvent } from '../../../utils/serverLogEvents';
import { LogAction } from '../../../utils/logTypes';
import { TeamBuilder } from '../../../lib/teambuilder';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { PlayerRole, normalizePlayerRoles } from '../../../lib/teambuilder';

// Interfaces tipo Member
type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: string;
  playerRoles?: PlayerRole[]; // Roles elegidos por el usuario con prioridades
  assignedRole?: string; // Rol asignado para la formación
  starRating?: number; // Nivel de habilidad del jugador (0-5)
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
    starRating?: number; // Nivel de habilidad del jugador
  }>;
  balanceByAge?: boolean;
  balanceByRole?: boolean; // Parámetro para equilibrar por rol
  balanceByRating?: boolean; // Nuevo parámetro para equilibrar por nivel de habilidad
  tbdPlayers?: {
    teamA: TbdPlayer[];
    teamB: TbdPlayer[];
  };
  isResort?: boolean;
  forceNewShuffle?: boolean;
  allowTbdPlayers?: boolean; // Nuevo parámetro para controlar si se deben generar jugadores TBD
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

// Eliminar la formación fija - ahora será más flexible
// Solo mantenemos que cada equipo debe tener máximo 1 arquero
const MAX_GOALKEEPERS_PER_TEAM = 1;

// Función para asignar roles de manera flexible (de atrás hacia adelante)
const assignFlexibleRole = (
  team: Member[],
  availableRoles: string[]
): string => {
  // Contar cuántos jugadores hay por posición en el equipo actual
  const roleCounts = {
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

  // Si ya hay un arquero, no asignar más arqueros
  if (roleCounts[PLAYER_ROLES.GOALKEEPER] >= MAX_GOALKEEPERS_PER_TEAM) {
    availableRoles = availableRoles.filter(
      (role) => role !== PLAYER_ROLES.GOALKEEPER
    );
  }

  // Si no hay roles disponibles, usar WILDCARD
  if (availableRoles.length === 0) {
    return PLAYER_ROLES.WILDCARD;
  }

  // Si solo hay un rol disponible, usarlo
  if (availableRoles.length === 1) {
    return availableRoles[0];
  }

  // NUEVA LÓGICA: Asegurar cobertura equilibrada de todas las posiciones
  // Calcular el tamaño ideal por posición basado en el tamaño actual del equipo
  const teamSize = team.length + 1; // +1 porque vamos a añadir este jugador
  const nonGkPositions = [
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
  ];

  // Filtrar solo las posiciones disponibles (excluyendo arquero si ya hay uno)
  const availableNonGkRoles = availableRoles.filter((role) =>
    nonGkPositions.includes(role)
  );

  if (availableNonGkRoles.length > 0) {
    // Encontrar la posición con menos jugadores para equilibrar
    let minRole = availableNonGkRoles[0];
    let minCount = roleCounts[minRole] || 0;

    for (const role of availableNonGkRoles) {
      const count = roleCounts[role] || 0;
      if (count < minCount) {
        minCount = count;
        minRole = role;
      }
    }

    // Verificar si hay posiciones completamente vacías
    const emptyPositions = availableNonGkRoles.filter(
      (role) => (roleCounts[role] || 0) === 0
    );

    // Si hay posiciones vacías, priorizar llenarlas primero
    if (emptyPositions.length > 0) {
      // Priorizar de atrás hacia adelante entre las posiciones vacías
      const priorityOrder = [
        PLAYER_ROLES.DEFENDER,
        PLAYER_ROLES.MIDFIELDER,
        PLAYER_ROLES.FORWARD,
      ];

      for (const role of priorityOrder) {
        if (emptyPositions.includes(role)) {
          return role;
        }
      }

      // Si no encuentra en el orden de prioridad, usar la primera vacía
      return emptyPositions[0];
    }

    // Si no hay posiciones vacías, verificar si hay desbalance significativo
    const maxCount = Math.max(
      ...availableNonGkRoles.map((role) => roleCounts[role] || 0)
    );
    const minCountActual = Math.min(
      ...availableNonGkRoles.map((role) => roleCounts[role] || 0)
    );

    // Si hay una diferencia de 2 o más jugadores entre posiciones, equilibrar
    if (maxCount - minCountActual >= 2) {
      return minRole; // Asignar a la posición con menos jugadores
    }

    // Si el balance es aceptable, usar el orden de prioridad normal
    const priorityOrder = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];

    for (const role of priorityOrder) {
      if (availableNonGkRoles.includes(role)) {
        // Solo asignar si no va a crear un desbalance excesivo
        const currentCount = roleCounts[role] || 0;
        const otherRoleCounts = availableNonGkRoles
          .filter((r) => r !== role)
          .map((r) => roleCounts[r] || 0);

        const maxOtherCount =
          otherRoleCounts.length > 0 ? Math.max(...otherRoleCounts) : 0;

        // Solo asignar si no va a crear una diferencia mayor a 2
        if (currentCount <= maxOtherCount + 1) {
          return role;
        }
      }
    }

    // Si todas las opciones crearían desbalance, usar la de menor count
    return minRole;
  }

  // Si no hay posiciones de campo disponibles, verificar si arquero está disponible
  if (availableRoles.includes(PLAYER_ROLES.GOALKEEPER)) {
    return PLAYER_ROLES.GOALKEEPER;
  }

  // Si no encuentra ninguno de los prioritarios, devolver el primero disponible o WILDCARD
  return availableRoles[0] || PLAYER_ROLES.WILDCARD;
};

// Función para verificar y corregir el balance de posiciones en un equipo
const balanceTeamPositions = (team: Member[]): Member[] => {
  if (!team || team.length === 0) return team;

  // Contar jugadores por posición
  const roleCounts = {
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

  const nonGkPositions = [
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
  ];
  const nonGkCounts = nonGkPositions.map((role) => roleCounts[role] || 0);

  // Si hay menos de 3 jugadores de campo, no hay mucho que balancear
  const totalNonGk = nonGkCounts.reduce((sum, count) => sum + count, 0);
  if (totalNonGk < 3) return team;

  // Encontrar posiciones vacías
  const emptyPositions = nonGkPositions.filter(
    (role) => (roleCounts[role] || 0) === 0
  );

  // Si hay posiciones vacías, intentar llenarlas
  if (emptyPositions.length > 0) {
    const result = [...team];

    // Encontrar posiciones con exceso (más de 2 jugadores de diferencia con la posición vacía)
    const positionsWithExcess = nonGkPositions.filter((role) => {
      const count = roleCounts[role] || 0;
      return count >= 3; // Si tiene 3 o más jugadores, puede donar uno
    });

    // Reasignar jugadores de posiciones con exceso a posiciones vacías
    for (const emptyPos of emptyPositions) {
      if (positionsWithExcess.length === 0) break;

      // Encontrar la posición con más jugadores para mover uno
      let maxRole = positionsWithExcess[0];
      let maxCount = roleCounts[maxRole] || 0;

      for (const role of positionsWithExcess) {
        const count = roleCounts[role] || 0;
        if (count > maxCount) {
          maxCount = count;
          maxRole = role;
        }
      }

      // Buscar un jugador de esa posición para reasignar
      const playerIndex = result.findIndex((p) => p.assignedRole === maxRole);
      if (playerIndex !== -1) {
        result[playerIndex] = {
          ...result[playerIndex],
          assignedRole: emptyPos,
        };

        // Actualizar conteos
        roleCounts[maxRole]--;
        roleCounts[emptyPos]++;

        // Si la posición ya no tiene exceso, removerla de la lista
        if (roleCounts[maxRole] < 3) {
          const index = positionsWithExcess.indexOf(maxRole);
          if (index > -1) {
            positionsWithExcess.splice(index, 1);
          }
        }

        console.log(
          `🔄 Rebalanceando equipo: Movido jugador de ${maxRole} a ${emptyPos}`
        );
      }
    }

    return result;
  }

  // Si no hay posiciones vacías, verificar desbalances extremos (diferencia > 2)
  const maxCount = Math.max(...nonGkCounts);
  const minCount = Math.min(...nonGkCounts);

  if (maxCount - minCount > 2) {
    const result = [...team];

    // Encontrar la posición con más jugadores
    let maxRole = nonGkPositions[0];
    let maxRoleCount = roleCounts[maxRole] || 0;

    for (const role of nonGkPositions) {
      const count = roleCounts[role] || 0;
      if (count > maxRoleCount) {
        maxRoleCount = count;
        maxRole = role;
      }
    }

    // Encontrar la posición con menos jugadores
    let minRole = nonGkPositions[0];
    let minRoleCount = roleCounts[minRole] || 0;

    for (const role of nonGkPositions) {
      const count = roleCounts[role] || 0;
      if (count < minRoleCount) {
        minRoleCount = count;
        minRole = role;
      }
    }

    // Mover un jugador de la posición con más a la posición con menos
    const playerIndex = result.findIndex((p) => p.assignedRole === maxRole);
    if (playerIndex !== -1 && maxRoleCount - minRoleCount > 2) {
      result[playerIndex] = {
        ...result[playerIndex],
        assignedRole: minRole,
      };

      console.log(
        `🔄 Rebalanceando equipo: Movido jugador de ${maxRole} (${maxRoleCount}) a ${minRole} (${minRoleCount})`
      );
    }

    return result;
  }

  return team;
};

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (
  playerRoles?: PlayerRole[] | string[]
): string | undefined => {
  const normalizedRoles = normalizePlayerRoles(playerRoles);
  if (normalizedRoles.length === 0) return undefined;

  // Ordenar por prioridad (menor número = mayor prioridad) y devolver el primer rol
  const sortedRoles = [...normalizedRoles].sort(
    (a, b) => a.priority - b.priority
  );
  return sortedRoles[0].role;
};

// Función para verificar si un jugador tiene un rol específico (primario o secundario)
const playerHasRole = (player: Member, targetRole: string): boolean => {
  if (!player.playerRoles) return false;

  return player.playerRoles.some((role) => {
    if (typeof role === 'string') {
      return role === targetRole;
    } else if (role && typeof role === 'object' && 'role' in role) {
      return role.role === targetRole;
    }
    return false;
  });
};

// Función para obtener jugadores disponibles por rol (primario + secundario + comodín)
const getAvailablePlayersByRole = (players: Member[]) => {
  const availableByRole: Record<
    string,
    { primary: Member[]; secondary: Member[]; wildcard: Member[] }
  > = {
    [PLAYER_ROLES.GOALKEEPER]: { primary: [], secondary: [], wildcard: [] },
    [PLAYER_ROLES.DEFENDER]: { primary: [], secondary: [], wildcard: [] },
    [PLAYER_ROLES.MIDFIELDER]: { primary: [], secondary: [], wildcard: [] },
    [PLAYER_ROLES.FORWARD]: { primary: [], secondary: [], wildcard: [] },
  };

  players.forEach((player) => {
    const primaryRole = getPrimaryRole(player.playerRoles);

    // Clasificar por rol primario
    if (primaryRole && availableByRole[primaryRole]) {
      availableByRole[primaryRole].primary.push(player);
    } else if (primaryRole === PLAYER_ROLES.WILDCARD) {
      // Los comodines se pueden usar para cualquier posición
      Object.keys(availableByRole).forEach((role) => {
        availableByRole[role].wildcard.push(player);
      });
    }

    // Buscar en roles secundarios (prioridad > 1)
    if (player.playerRoles) {
      const normalizedRoles = normalizePlayerRoles(player.playerRoles);
      normalizedRoles.forEach((roleObj) => {
        // Si no es el rol primario y tiene menor prioridad
        if (
          roleObj.role !== primaryRole &&
          roleObj.priority > 1 &&
          availableByRole[roleObj.role]
        ) {
          availableByRole[roleObj.role].secondary.push(player);
        }
      });
    }
  });

  return availableByRole;
};

// Función inteligente para asignar jugadores a una posición específica
const assignPlayersToPosition = (
  targetRole: string,
  maxPlayers: number,
  availableByRole: Record<
    string,
    { primary: Member[]; secondary: Member[]; wildcard: Member[] }
  >,
  assignedPlayers: Set<string>,
  allPlayers: Member[] // Para fallback aleatorio
): Member[] => {
  const assigned: Member[] = [];
  const roleData = availableByRole[targetRole];

  console.log(`🎯 Asignando ${targetRole} (máximo ${maxPlayers}):`);
  console.log(`  - Primarios disponibles: ${roleData.primary.length}`);
  console.log(`  - Secundarios disponibles: ${roleData.secondary.length}`);
  console.log(`  - Comodines disponibles: ${roleData.wildcard.length}`);

  // 1. Asignar jugadores con rol primario PRIMERO
  for (const player of roleData.primary) {
    if (assigned.length >= maxPlayers) break;
    if (assignedPlayers.has(player.id)) continue;

    assigned.push({ ...player, assignedRole: targetRole });
    assignedPlayers.add(player.id);
    console.log(`  ✅ Asignado PRIMARIO: ${player.name} -> ${targetRole}`);
  }

  // 2. Si necesitamos más, usar jugadores con rol secundario
  if (assigned.length < maxPlayers) {
    for (const player of roleData.secondary) {
      if (assigned.length >= maxPlayers) break;
      if (assignedPlayers.has(player.id)) continue;

      assigned.push({ ...player, assignedRole: targetRole });
      assignedPlayers.add(player.id);
      console.log(`  ✅ Asignado SECUNDARIO: ${player.name} -> ${targetRole}`);
    }
  }

  // 3. Si aún necesitamos más, usar comodines
  if (assigned.length < maxPlayers) {
    for (const player of roleData.wildcard) {
      if (assigned.length >= maxPlayers) break;
      if (assignedPlayers.has(player.id)) continue;

      assigned.push({ ...player, assignedRole: targetRole });
      assignedPlayers.add(player.id);
      console.log(`  ✅ Asignado COMODÍN: ${player.name} -> ${targetRole}`);
    }
  }

  // 4. ÚLTIMO RECURSO: Asignar jugadores al azar si es crítico (solo para arqueros)
  if (assigned.length < maxPlayers && targetRole === PLAYER_ROLES.GOALKEEPER) {
    console.log(
      `  ⚠️ ÚLTIMO RECURSO: Buscando jugador aleatorio para ${targetRole}`
    );

    const availablePlayers = allPlayers.filter(
      (p) => !assignedPlayers.has(p.id)
    );
    if (availablePlayers.length > 0) {
      // Seleccionar aleatoriamente
      const randomPlayer =
        availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
      assigned.push({ ...randomPlayer, assignedRole: targetRole });
      assignedPlayers.add(randomPlayer.id);
      console.log(
        `  🎲 Asignado ALEATORIO: ${randomPlayer.name} -> ${targetRole}`
      );
    }
  }

  console.log(
    `  📊 Total asignados para ${targetRole}: ${assigned.length}/${maxPlayers}`
  );
  return assigned;
};

// Nueva función inteligente para balancear equipos por rol MANTENIENDO BALANCE DE JUGADORES
const createIntelligentRoleBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  console.log('🧠 Iniciando asignación inteligente de roles...');
  console.log(`👥 Total jugadores: ${members.length}`);

  const availableByRole = getAvailablePlayersByRole(members);
  const assignedPlayers = new Set<string>();

  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // PASO 1: Asignar arqueros (crítico - 1 por equipo)
  console.log('🥅 PASO 1: Asignando arqueros...');

  const goalkeepersA = assignPlayersToPosition(
    PLAYER_ROLES.GOALKEEPER,
    1,
    availableByRole,
    assignedPlayers,
    members
  );
  teamA.push(...goalkeepersA);

  const goalkeepersB = assignPlayersToPosition(
    PLAYER_ROLES.GOALKEEPER,
    1,
    availableByRole,
    assignedPlayers,
    members
  );
  teamB.push(...goalkeepersB);

  console.log(
    `🥅 Arqueros asignados: Team A (${goalkeepersA.length}), Team B (${goalkeepersB.length})`
  );

  // PASO 2: Crear pool de jugadores restantes ordenados por preferencia
  const remainingPlayers = members.filter((p) => !assignedPlayers.has(p.id));
  console.log(
    `🎯 PASO 2: Distribuyendo ${remainingPlayers.length} jugadores restantes...`
  );

  // Ordenar jugadores por preferencias para maximizar satisfacción
  const prioritizedPlayers = remainingPlayers.sort((a, b) => {
    const roleA = getPrimaryRole(a.playerRoles);
    const roleB = getPrimaryRole(b.playerRoles);

    // Priorizar jugadores con roles específicos sobre comodines
    if (roleA === PLAYER_ROLES.WILDCARD && roleB !== PLAYER_ROLES.WILDCARD)
      return 1;
    if (roleB === PLAYER_ROLES.WILDCARD && roleA !== PLAYER_ROLES.WILDCARD)
      return -1;

    // Mantener orden original para roles similares
    return 0;
  });

  // PASO 3: Distribuir alternadamente manteniendo balance de equipos
  prioritizedPlayers.forEach((player, index) => {
    // Alternar basándose en el balance actual de equipos
    const shouldGoToA = teamA.length <= teamB.length;
    const targetTeam = shouldGoToA ? teamA : teamB;
    const teamName = shouldGoToA ? 'A' : 'B';

    // Asignar rol inteligente basado en preferencias y necesidades del equipo
    const assignedRole = determineSmartRole(player, targetTeam);
    targetTeam.push({ ...player, assignedRole });

    console.log(
      `👤 ${
        player.name
      } -> Team ${teamName} como ${assignedRole} (preferencia: ${getPrimaryRole(
        player.playerRoles
      )})`
    );
  });

  console.log(
    `✅ Distribución final: Team A (${teamA.length}), Team B (${teamB.length})`
  );

  // PASO 4: Verificar balance final
  const diff = Math.abs(teamA.length - teamB.length);
  if (diff > 1) {
    console.log(`⚠️ Desbalance detectado (${diff}), corrigiendo...`);
    // Mover jugadores para equilibrar
    if (teamA.length > teamB.length) {
      const playersToMove = Math.floor(diff / 2);
      for (let i = 0; i < playersToMove; i++) {
        const playerToMove = teamA.pop();
        if (playerToMove) teamB.push(playerToMove);
      }
    } else {
      const playersToMove = Math.floor(diff / 2);
      for (let i = 0; i < playersToMove; i++) {
        const playerToMove = teamB.pop();
        if (playerToMove) teamA.push(playerToMove);
      }
    }
    console.log(
      `✅ Balance corregido: Team A (${teamA.length}), Team B (${teamB.length})`
    );
  }

  return [teamA, teamB];
};

// Función para determinar el rol más inteligente para un jugador en un equipo específico
const determineSmartRole = (player: Member, team: Member[]): string => {
  const primaryRole = getPrimaryRole(player.playerRoles);

  // Si el jugador tiene un rol primario específico, usarlo
  if (primaryRole && primaryRole !== PLAYER_ROLES.WILDCARD) {
    return primaryRole;
  }

  // Si es comodín o no tiene rol, asignar basado en necesidades del equipo
  const teamRoles = team.map((p) => p.assignedRole).filter(Boolean);
  const roleCounts = {
    [PLAYER_ROLES.GOALKEEPER]: teamRoles.filter(
      (r) => r === PLAYER_ROLES.GOALKEEPER
    ).length,
    [PLAYER_ROLES.DEFENDER]: teamRoles.filter(
      (r) => r === PLAYER_ROLES.DEFENDER
    ).length,
    [PLAYER_ROLES.MIDFIELDER]: teamRoles.filter(
      (r) => r === PLAYER_ROLES.MIDFIELDER
    ).length,
    [PLAYER_ROLES.FORWARD]: teamRoles.filter((r) => r === PLAYER_ROLES.FORWARD)
      .length,
  };

  // Buscar el rol con menor representación (excluyendo arquero que ya está asignado)
  const availableRoles = [
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
  ];

  // Ordenar por menor cantidad en el equipo
  availableRoles.sort((a, b) => roleCounts[a] - roleCounts[b]);

  // Si el jugador tiene este rol como secundario, preferirlo
  if (player.playerRoles) {
    for (const role of availableRoles) {
      if (playerHasRole(player, role)) {
        return role;
      }
    }
  }

  // Si no tiene preferencia, asignar el rol menos representado
  return availableRoles[0];
};

// Función para balancear equipos por rol y edad simultáneamente (ORIGINAL - mantener para compatibilidad)
const createRoleAndAgeBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Separar jugadores por su rol principal
  const playersByRole: Record<string, Member[]> = {};
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

  // Función para distribuir jugadores por rol de manera flexible
  const distributeRoleFlexibly = (role: string) => {
    const players = playersByRole[role] || [];
    if (players.length === 0) return { teamA: [], teamB: [], remaining: [] };

    // Ordenar por edad (mayor a menor)
    const sortedByAge = [...players].sort((a, b) => {
      if (
        a.age !== null &&
        a.age !== undefined &&
        b.age !== null &&
        b.age !== undefined
      ) {
        return b.age - a.age;
      }
      if (a.age !== null && a.age !== undefined) return -1;
      if (b.age !== null && b.age !== undefined) return 1;
      return 0;
    });

    const forTeamA: Member[] = [];
    const forTeamB: Member[] = [];

    // Para arqueros, máximo 1 por equipo
    if (role === PLAYER_ROLES.GOALKEEPER) {
      if (sortedByAge.length >= 2) {
        forTeamA.push({ ...sortedByAge[0], assignedRole: role });
        forTeamB.push({ ...sortedByAge[1], assignedRole: role });
        return {
          teamA: forTeamA,
          teamB: forTeamB,
          remaining: sortedByAge.slice(2),
        };
      } else if (sortedByAge.length === 1) {
        // Asignar al equipo con menos jugadores o aleatoriamente si están iguales
        if (teamA.length <= teamB.length) {
          forTeamA.push({ ...sortedByAge[0], assignedRole: role });
        } else {
          forTeamB.push({ ...sortedByAge[0], assignedRole: role });
        }
        return {
          teamA: forTeamA,
          teamB: forTeamB,
          remaining: [],
        };
      }

      // NUEVO: Si no hay arqueros principales, buscar en roles secundarios
      console.log(
        '🥅 No hay arqueros principales, buscando en roles secundarios...'
      );

      // Buscar jugadores con arquero como rol secundario en otras posiciones
      const findPlayerWithSecondaryGoalkeeperRole = (
        playersPool: Member[]
      ): Member | null => {
        for (const player of playersPool) {
          const hasGoalkeeperRole = player.playerRoles?.some((playerRole) => {
            if (typeof playerRole === 'string') {
              return playerRole === PLAYER_ROLES.GOALKEEPER;
            } else if (
              playerRole &&
              typeof playerRole === 'object' &&
              'role' in playerRole
            ) {
              return playerRole.role === PLAYER_ROLES.GOALKEEPER;
            }
            return false;
          });

          if (hasGoalkeeperRole) {
            console.log(
              `🥅 Encontrado jugador con rol secundario de arquero: ${player.name}`
            );
            return player;
          }
        }
        return null;
      };

      // Buscar en todos los otros roles
      const allOtherPlayers: Member[] = [
        ...(playersByRole[PLAYER_ROLES.DEFENDER] || []),
        ...(playersByRole[PLAYER_ROLES.MIDFIELDER] || []),
        ...(playersByRole[PLAYER_ROLES.FORWARD] || []),
        ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
      ];

      const candidateGK =
        findPlayerWithSecondaryGoalkeeperRole(allOtherPlayers);
      if (candidateGK) {
        // Asignar al equipo con menos jugadores
        if (teamA.length <= teamB.length) {
          forTeamA.push({ ...candidateGK, assignedRole: role });
        } else {
          forTeamB.push({ ...candidateGK, assignedRole: role });
        }

        // Remover de su posición original
        Object.keys(playersByRole).forEach((pos) => {
          const index = playersByRole[pos].findIndex(
            (p) => p.id === candidateGK.id
          );
          if (index !== -1) {
            playersByRole[pos].splice(index, 1);
            console.log(
              `🥅 Removido ${candidateGK.name} de ${pos} para asignarlo como arquero`
            );
          }
        });

        return {
          teamA: forTeamA,
          teamB: forTeamB,
          remaining: [],
        };
      }

      return { teamA: [], teamB: [], remaining: sortedByAge };
    }

    // Para otras posiciones, distribuir alternadamente para balancear edades
    sortedByAge.forEach((player, index) => {
      if (index % 2 === 0) {
        forTeamA.push({ ...player, assignedRole: role });
      } else {
        forTeamB.push({ ...player, assignedRole: role });
      }
    });

    return {
      teamA: forTeamA,
      teamB: forTeamB,
      remaining: [],
    };
  };

  // Distribuir arqueros primero (máximo 1 por equipo)
  const gkResult = distributeRoleFlexibly(PLAYER_ROLES.GOALKEEPER);
  teamA.push(...gkResult.teamA);
  teamB.push(...gkResult.teamB);
  playersWithoutRole.push(...gkResult.remaining);

  // Distribuir defensores
  const defResult = distributeRoleFlexibly(PLAYER_ROLES.DEFENDER);
  teamA.push(...defResult.teamA);
  teamB.push(...defResult.teamB);
  playersWithoutRole.push(...defResult.remaining);

  // Distribuir mediocampistas
  const midResult = distributeRoleFlexibly(PLAYER_ROLES.MIDFIELDER);
  teamA.push(...midResult.teamA);
  teamB.push(...midResult.teamB);
  playersWithoutRole.push(...midResult.remaining);

  // Distribuir delanteros
  const fwdResult = distributeRoleFlexibly(PLAYER_ROLES.FORWARD);
  teamA.push(...fwdResult.teamA);
  teamB.push(...fwdResult.teamB);
  playersWithoutRole.push(...fwdResult.remaining);

  // Distribuir comodines y jugadores sobrantes
  const remainingWithWildcards = [
    ...playersWithoutRole,
    ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
  ];

  // Ordenar jugadores restantes por edad
  const sortedRemaining = [...remainingWithWildcards].sort((a, b) => {
    if (
      a.age !== null &&
      a.age !== undefined &&
      b.age !== null &&
      b.age !== undefined
    ) {
      return b.age - a.age;
    }
    if (a.age !== null && a.age !== undefined) return -1;
    if (b.age !== null && b.age !== undefined) return 1;
    return 0;
  });

  // Distribuir jugadores restantes priorizando defensores y luego mediocampo
  sortedRemaining.forEach((player, index) => {
    // Determinar a qué equipo asignar (alternando)
    const targetTeam = index % 2 === 0 ? teamA : teamB;

    // Asignar rol flexible priorizando defensor > mediocampo > delantero
    const availableRoles = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];
    const assignedRole = assignFlexibleRole(targetTeam, availableRoles);

    targetTeam.push({ ...player, assignedRole });
  });

  // Verificar y corregir balance final si hay una diferencia mayor a 1 jugador entre equipos
  if (Math.abs(teamA.length - teamB.length) > 1) {
    console.log(
      `Corrigiendo desbalance en createRoleAndAgeBalancedTeams: TeamA=${teamA.length}, TeamB=${teamB.length}`
    );

    // Determinar qué equipo tiene más jugadores y cuál tiene menos
    let sourceTeam = teamA.length > teamB.length ? teamA : teamB;
    let targetTeam = teamA.length > teamB.length ? teamB : teamA;

    // Calcular cuántos jugadores mover para equilibrar
    const diff = Math.abs(teamA.length - teamB.length);
    const playersToMove = Math.floor(diff / 2);

    console.log(`Moviendo ${playersToMove} jugadores para equilibrar equipos`);

    for (let i = 0; i < playersToMove; i++) {
      // Preferir mover jugadores sin rol específico o con rol WILDCARD
      let playerIndex = sourceTeam.findIndex(
        (p) => !p.assignedRole || p.assignedRole === PLAYER_ROLES.WILDCARD
      );

      // Si no hay wildcards, buscar en roles con más jugadores (excluyendo arqueros)
      if (playerIndex === -1) {
        const roleCounts: Record<string, number> = {};
        sourceTeam.forEach((p) => {
          if (p.assignedRole && p.assignedRole !== PLAYER_ROLES.GOALKEEPER) {
            roleCounts[p.assignedRole] = (roleCounts[p.assignedRole] || 0) + 1;
          }
        });

        // Encontrar el rol con más jugadores
        let maxRole = '';
        let maxCount = 0;
        for (const [role, count] of Object.entries(roleCounts)) {
          if (count > maxCount) {
            maxRole = role;
            maxCount = count;
          }
        }

        // Buscar un jugador de ese rol
        if (maxRole) {
          playerIndex = sourceTeam.findIndex((p) => p.assignedRole === maxRole);
        }

        // Si aún no encontramos, tomar cualquier jugador que no sea arquero
        if (playerIndex === -1) {
          playerIndex = sourceTeam.findIndex(
            (p) => p.assignedRole !== PLAYER_ROLES.GOALKEEPER
          );
        }
      }

      // Si aún no encontramos, tomar el último jugador
      if (playerIndex === -1 && sourceTeam.length > 0) {
        playerIndex = sourceTeam.length - 1;
      }

      // Mover el jugador si lo encontramos
      if (playerIndex !== -1) {
        const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
        targetTeam.push(playerToMove);
      }
    }

    console.log(
      `Balance corregido: TeamA=${teamA.length}, TeamB=${teamB.length}`
    );
  }

  // Registrar en la consola la distribución de roles
  console.log('Distribución de jugadores por rol y edad (flexible):');
  Object.values(PLAYER_ROLES).forEach((roleName) => {
    console.log(
      `${roleName}: ${playersByRole[roleName]?.length || 0} jugadores`
    );
  });
  console.log(`Sin rol asignado: ${playersWithoutRole.length} jugadores`);
  console.log(
    `Equipo A: ${teamA.length} jugadores, Equipo B: ${teamB.length} jugadores`
  );

  // Aplicar balance final de posiciones a ambos equipos
  teamA = balanceTeamPositions(teamA);
  teamB = balanceTeamPositions(teamB);

  return [teamA, teamB];
};

// Función para balancear equipos por nivel de habilidad (star rating)
const createRatingBalancedTeams = (members: Member[]): [Member[], Member[]] => {
  // Agrupar jugadores por niveles de rating similares
  const playersByRating: Record<number, Member[]> = {};

  // Clasificar jugadores por rating
  members.forEach((member) => {
    const rating =
      member.starRating !== undefined && member.starRating !== null
        ? Math.floor(member.starRating)
        : 3; // Rating por defecto si no está definido

    if (!playersByRating[rating]) {
      playersByRating[rating] = [];
    }
    playersByRating[rating].push(member);
  });

  // Obtener ratings en orden descendente
  const ratings = Object.keys(playersByRating)
    .map(Number)
    .sort((a, b) => b - a);

  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Para cada nivel de rating, mezclar y distribuir
  ratings.forEach((rating) => {
    // Mezclar jugadores con el mismo rating
    const shuffledSameRating = [...playersByRating[rating]].sort(
      () => Math.random() - 0.5
    );

    // Distribuir alternadamente
    shuffledSameRating.forEach((member, index) => {
      if (index % 2 === 0) {
        teamA.push(member);
      } else {
        teamB.push(member);
      }
    });
  });

  // Verificar y corregir el balance de jugadores reales
  // Aplicar balance final de posiciones a ambos equipos
  teamA = balanceTeamPositions(teamA);
  teamB = balanceTeamPositions(teamB);

  return [teamA, teamB];
};

// Función que combina balanceo por roles, edad y rating
const createCombinedBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Separar jugadores por su rol principal
  const playersByRole: Record<string, Member[]> = {};
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

  // Función para distribuir jugadores por rol combinando edad y rating de manera flexible
  const distributeRoleByAgeAndRatingFlexibly = (role: string) => {
    const players = playersByRole[role] || [];
    if (players.length === 0) return { teamA: [], teamB: [], remaining: [] };

    // Agrupar jugadores por su puntaje combinado (con una precisión de 1 decimal)
    const playersByScore: Record<string, Member[]> = {};

    players.forEach((player) => {
      // Calcular puntuación combinada: 70% rating + 30% edad normalizada
      const score =
        (player.starRating || 3) * 0.7 + ((player.age || 30) / 50) * 0.3;
      const scoreKey = score.toFixed(1); // Agrupar con precisión de un decimal

      if (!playersByScore[scoreKey]) {
        playersByScore[scoreKey] = [];
      }
      playersByScore[scoreKey].push(player);
    });

    // Obtener puntajes en orden descendente
    const scores = Object.keys(playersByScore)
      .map(Number)
      .sort((a, b) => b - a);

    // Preparar arreglos para cada equipo
    const forTeamA: Member[] = [];
    const forTeamB: Member[] = [];

    // Para arqueros, máximo 1 por equipo
    if (role === PLAYER_ROLES.GOALKEEPER) {
      let playersAssigned = 0;

      for (const score of scores) {
        const shuffledSameScore = [...playersByScore[score.toFixed(1)]].sort(
          () => Math.random() - 0.5
        );

        for (const player of shuffledSameScore) {
          if (playersAssigned >= 2) break;

          if (playersAssigned === 0) {
            forTeamA.push({ ...player, assignedRole: role });
          } else if (playersAssigned === 1) {
            forTeamB.push({ ...player, assignedRole: role });
          }
          playersAssigned++;
        }

        if (playersAssigned >= 2) break;
      }

      // Determinar jugadores sobrantes
      const usedPlayers = [...forTeamA, ...forTeamB].map((p) => p.id);
      const remaining = players.filter((p) => !usedPlayers.includes(p.id));

      return {
        teamA: forTeamA,
        teamB: forTeamB,
        remaining,
      };
    }

    // Para otras posiciones, distribuir alternadamente
    for (const score of scores) {
      // Mezclar jugadores con el mismo puntaje
      const shuffledSameScore = [...playersByScore[score.toFixed(1)]].sort(
        () => Math.random() - 0.5
      );

      // Distribuir alternadamente
      shuffledSameScore.forEach((player, index) => {
        if (index % 2 === 0) {
          forTeamA.push({ ...player, assignedRole: role });
        } else {
          forTeamB.push({ ...player, assignedRole: role });
        }
      });
    }

    return {
      teamA: forTeamA,
      teamB: forTeamB,
      remaining: [],
    };
  };

  // Distribuir arqueros primero (máximo 1 por equipo)
  const gkResult = distributeRoleByAgeAndRatingFlexibly(
    PLAYER_ROLES.GOALKEEPER
  );
  teamA.push(...gkResult.teamA);
  teamB.push(...gkResult.teamB);
  playersWithoutRole.push(...gkResult.remaining);

  // NUEVO: Verificar si algún equipo necesita arquero y buscar en roles secundarios
  const teamAHasGK = teamA.some(
    (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
  );
  const teamBHasGK = teamB.some(
    (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
  );

  if (!teamAHasGK || !teamBHasGK) {
    console.log(
      `🥅 Verificando arqueros en createCombinedBalancedTeams: A=${teamAHasGK}, B=${teamBHasGK}`
    );

    // Buscar jugadores con rol secundario de arquero en todas las posiciones
    const findPlayerWithSecondaryGoalkeeperRole = (
      playersPool: Member[]
    ): Member | null => {
      for (const player of playersPool) {
        const hasGoalkeeperRole = player.playerRoles?.some((playerRole) => {
          if (typeof playerRole === 'string') {
            return playerRole === PLAYER_ROLES.GOALKEEPER;
          } else if (
            playerRole &&
            typeof playerRole === 'object' &&
            'role' in playerRole
          ) {
            return playerRole.role === PLAYER_ROLES.GOALKEEPER;
          }
          return false;
        });

        if (hasGoalkeeperRole) {
          console.log(
            `🥅 Encontrado jugador con rol secundario de arquero: ${player.name}`
          );
          return player;
        }
      }
      return null;
    };

    // Recopilar todos los jugadores disponibles de otras posiciones
    const allAvailablePlayers: Member[] = [
      ...(playersByRole[PLAYER_ROLES.DEFENDER] || []),
      ...(playersByRole[PLAYER_ROLES.MIDFIELDER] || []),
      ...(playersByRole[PLAYER_ROLES.FORWARD] || []),
      ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
    ];

    // Asignar arqueros a equipos que los necesiten
    if (!teamAHasGK) {
      const candidateGK =
        findPlayerWithSecondaryGoalkeeperRole(allAvailablePlayers);
      if (candidateGK) {
        teamA.push({ ...candidateGK, assignedRole: PLAYER_ROLES.GOALKEEPER });
        console.log(
          `🥅 Asignado arquero secundario ${candidateGK.name} al equipo A`
        );

        // Remover de su posición original
        Object.keys(playersByRole).forEach((pos) => {
          const index = playersByRole[pos].findIndex(
            (p) => p.id === candidateGK.id
          );
          if (index !== -1) {
            playersByRole[pos].splice(index, 1);
            console.log(
              `🥅 Removido ${candidateGK.name} de ${pos} para asignarlo como arquero`
            );
          }
        });
      }
    }

    if (!teamBHasGK) {
      // Recopilar jugadores disponibles actualizados después de posible asignación anterior
      const remainingAvailablePlayers: Member[] = [
        ...(playersByRole[PLAYER_ROLES.DEFENDER] || []),
        ...(playersByRole[PLAYER_ROLES.MIDFIELDER] || []),
        ...(playersByRole[PLAYER_ROLES.FORWARD] || []),
        ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
      ];

      const candidateGK = findPlayerWithSecondaryGoalkeeperRole(
        remainingAvailablePlayers
      );
      if (candidateGK) {
        teamB.push({ ...candidateGK, assignedRole: PLAYER_ROLES.GOALKEEPER });
        console.log(
          `🥅 Asignado arquero secundario ${candidateGK.name} al equipo B`
        );

        // Remover de su posición original
        Object.keys(playersByRole).forEach((pos) => {
          const index = playersByRole[pos].findIndex(
            (p) => p.id === candidateGK.id
          );
          if (index !== -1) {
            playersByRole[pos].splice(index, 1);
            console.log(
              `🥅 Removido ${candidateGK.name} de ${pos} para asignarlo como arquero`
            );
          }
        });
      }
    }
  }

  // Distribuir defensores
  const defResult = distributeRoleByAgeAndRatingFlexibly(PLAYER_ROLES.DEFENDER);
  teamA.push(...defResult.teamA);
  teamB.push(...defResult.teamB);
  playersWithoutRole.push(...defResult.remaining);

  // Distribuir mediocampistas
  const midResult = distributeRoleByAgeAndRatingFlexibly(
    PLAYER_ROLES.MIDFIELDER
  );
  teamA.push(...midResult.teamA);
  teamB.push(...midResult.teamB);
  playersWithoutRole.push(...midResult.remaining);

  // Distribuir delanteros
  const fwdResult = distributeRoleByAgeAndRatingFlexibly(PLAYER_ROLES.FORWARD);
  teamA.push(...fwdResult.teamA);
  teamB.push(...fwdResult.teamB);
  playersWithoutRole.push(...fwdResult.remaining);

  // Distribuir comodines y jugadores sobrantes por combinación de edad y rating
  const remainingWithWildcards = [
    ...playersWithoutRole,
    ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
  ];

  // Ordenar jugadores restantes por combinación de edad y rating
  const sortedRemaining = [...remainingWithWildcards].sort((a, b) => {
    // Usar la misma fórmula de ponderación
    const scoreA = (a.starRating || 3) * 0.7 + ((a.age || 30) / 50) * 0.3;
    const scoreB = (b.starRating || 3) * 0.7 + ((b.age || 30) / 50) * 0.3;

    return scoreB - scoreA;
  });

  // Distribuir jugadores restantes priorizando defensores y luego mediocampo
  sortedRemaining.forEach((player, index) => {
    // Determinar a qué equipo asignar (alternando)
    const targetTeam = index % 2 === 0 ? teamA : teamB;

    // Asignar rol flexible priorizando defensor > mediocampo > delantero
    const availableRoles = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];
    const assignedRole = assignFlexibleRole(targetTeam, availableRoles);

    targetTeam.push({ ...player, assignedRole });
  });

  // PASO 1: Separar jugadores reales vs TBD en cada equipo
  const realPlayersA = teamA.filter(
    (p) => p && p.id && !p.id.toString().startsWith('tbd-')
  );
  const tbdPlayersA = teamA.filter(
    (p) => p && p.id && p.id.toString().startsWith('tbd-')
  );
  const realPlayersB = teamB.filter(
    (p) => p && p.id && !p.id.toString().startsWith('tbd-')
  );
  const tbdPlayersB = teamB.filter(
    (p) => p && p.id && p.id.toString().startsWith('tbd-')
  );

  // PASO 2: Verificar si hay desbalance de jugadores reales
  const realPlayerDiff = Math.abs(realPlayersA.length - realPlayersB.length);

  if (realPlayerDiff > 1) {
    console.log(
      `Corrigiendo desbalance de jugadores reales: A=${realPlayersA.length}, B=${realPlayersB.length}`
    );

    // Determinar qué equipo tiene más jugadores reales
    let sourceTeam =
      realPlayersA.length > realPlayersB.length ? realPlayersA : realPlayersB;
    let targetTeam =
      realPlayersA.length > realPlayersB.length ? realPlayersB : realPlayersA;
    const movingFromAtoB = realPlayersA.length > realPlayersB.length;

    // Calcular cuántos jugadores reales mover
    const playersToMove = Math.floor(realPlayerDiff / 2);

    // Realizar las transferencias
    for (let i = 0; i < playersToMove; i++) {
      if (sourceTeam.length > 0) {
        // Obtener un jugador para mover (aleatorio para evitar patrones)
        const playerIndex = Math.floor(Math.random() * sourceTeam.length);
        const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
        targetTeam.push(playerToMove);

        // Actualizar los arrays originales
        if (movingFromAtoB) {
          // Eliminar de A
          const indexInTeamA = teamA.findIndex((p) => p.id === playerToMove.id);
          if (indexInTeamA !== -1) {
            teamA.splice(indexInTeamA, 1);
            teamB.push(playerToMove);
          }
        } else {
          // Eliminar de B
          const indexInTeamB = teamB.findIndex((p) => p.id === playerToMove.id);
          if (indexInTeamB !== -1) {
            teamB.splice(indexInTeamB, 1);
            teamA.push(playerToMove);
          }
        }
      }
    }

    console.log(
      `Balance final de jugadores reales: A=${
        teamA.filter((p) => p && p.id && !p.id.toString().startsWith('tbd-'))
          .length
      }, B=${
        teamB.filter((p) => p && p.id && !p.id.toString().startsWith('tbd-'))
          .length
      }`
    );
  }

  // PASO 3: Verificar balance general, incluyendo TBD players
  if (Math.abs(teamA.length - teamB.length) > 1) {
    console.log(
      `Corrigiendo desbalance general: TeamA=${teamA.length}, TeamB=${teamB.length}`
    );

    // Determinar qué equipo tiene más jugadores y cuál tiene menos
    let sourceTeam = teamA.length > teamB.length ? teamA : teamB;
    let targetTeam = teamA.length > teamB.length ? teamB : teamA;

    // Calcular cuántos jugadores mover para equilibrar
    const diff = Math.abs(teamA.length - teamB.length);
    const playersToMove = Math.floor(diff / 2);

    console.log(`Moviendo ${playersToMove} jugadores para equilibrar equipos`);

    for (let i = 0; i < playersToMove; i++) {
      // Preferir mover jugadores TBD primero
      let playerIndex = sourceTeam.findIndex(
        (p) => p && p.id && p.id.toString().startsWith('tbd-')
      );

      // Si no hay TBD, buscar jugadores con rol WILDCARD o de posiciones con exceso
      if (playerIndex === -1) {
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

      // Si aún no encontramos, tomar el último jugador
      if (playerIndex === -1 && sourceTeam.length > 0) {
        playerIndex = sourceTeam.length - 1;
      }

      // Mover el jugador si lo encontramos
      if (playerIndex !== -1) {
        const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
        targetTeam.push(playerToMove);
      }
    }

    console.log(
      `Balance final general: Equipo A (${teamA.length}) vs Equipo B (${teamB.length})`
    );
  }

  // Aplicar balance final de posiciones a ambos equipos
  teamA = balanceTeamPositions(teamA);
  teamB = balanceTeamPositions(teamB);

  return [teamA, teamB];
};

// Función mejorada que implementa un algoritmo de balanceo multicriteria
const createBalancedTeamsByMultiCriteria = (
  members: Member[]
): [Member[], Member[]] => {
  // 1. PREPROCESAMIENTO: Calcular puntaje total ponderado
  const membersWithScore = members.map((member) => {
    // Normalizar edad (0-1): los más jóvenes tienen valores más altos
    const ageNormalized = member.age ? Math.max(0, 1 - member.age / 50) : 0.5;

    // Normalizar habilidad (0-1)
    const skillNormalized = (member.starRating || 3) / 5;

    // Calcular versatilidad (0-1)
    const rolesCount = member.playerRoles?.length || 0;
    const isWildcard =
      member.playerRoles?.some((role) => role.role === PLAYER_ROLES.WILDCARD) ||
      false;
    const versatilityNormalized = isWildcard ? 1 : Math.min(1, rolesCount / 3);

    // Puntaje ponderado: 60% habilidad + 30% edad + 10% versatilidad
    const totalScore =
      skillNormalized * 0.6 + ageNormalized * 0.3 + versatilityNormalized * 0.1;

    return {
      ...member,
      totalScore,
      normalizedValues: {
        age: ageNormalized,
        skill: skillNormalized,
        versatility: versatilityNormalized,
      },
    };
  });

  // 2. POSICIONAMIENTO INICIAL POR ROL CRÍTICO
  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Función para calcular métricas de equipo
  const calculateTeamMetrics = (team: Member[]) => {
    const skillAvg =
      team.reduce((sum, p) => sum + (p.starRating || 3), 0) /
      (team.length || 1);
    const ageAvg =
      team.reduce((sum, p) => sum + (p.age || 30), 0) / (team.length || 1);

    // Conteo de roles para evitar duplicados innecesarios
    const roleCounts: Record<string, number> = {};
    team.forEach((p) => {
      const role = p.assignedRole || getPrimaryRole(p.playerRoles);
      if (role) {
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    });

    // Calcular el nivel de habilidad máximo y mínimo
    const maxSkill = team.length
      ? Math.max(...team.map((p) => p.starRating || 3))
      : 3;
    const minSkill = team.length
      ? Math.min(...team.map((p) => p.starRating || 3))
      : 3;

    return {
      skillAvg,
      ageAvg,
      roleCounts,
      maxSkill,
      minSkill,
      skillSpread: maxSkill - minSkill,
    };
  };

  // Asignar jugadores por posición en orden de prioridad
  const positionOrder = [
    PLAYER_ROLES.GOALKEEPER,
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
  ];

  // Jugadores por posición
  const playersByPosition: Record<string, any[]> = {};
  const wildcards: any[] = [];

  // Clasificar jugadores por posición principal
  membersWithScore.forEach((player) => {
    // Obtener rol principal o asignar a comodines
    const primaryRole = getPrimaryRole(player.playerRoles);
    if (primaryRole === PLAYER_ROLES.WILDCARD) {
      wildcards.push(player);
    } else if (primaryRole) {
      if (!playersByPosition[primaryRole]) playersByPosition[primaryRole] = [];
      playersByPosition[primaryRole].push(player);
    } else {
      wildcards.push(player);
    }
  });

  // MEJORA 1: Distribuir posiciones críticas primero (arqueros) asegurando que no haya duplicados innecesarios
  const distributeGoalkeepers = () => {
    const goalkeepers = playersByPosition[PLAYER_ROLES.GOALKEEPER] || [];

    console.log(`🧤 Distribuyendo ${goalkeepers.length} arqueros disponibles`);

    // Ordenar arqueros por habilidad (de mayor a menor)
    goalkeepers.sort((a, b) => (b.starRating || 3) - (a.starRating || 3));

    // Caso ideal: Hay al menos un arquero para cada equipo
    if (goalkeepers.length >= 2) {
      // Asignar el mejor arquero al equipo con menor nivel general para equilibrar
      const metricsA = calculateTeamMetrics(teamA);
      const metricsB = calculateTeamMetrics(teamB);

      if (metricsA.skillAvg <= metricsB.skillAvg) {
        // Equipo A tiene menor nivel, darle el mejor arquero
        teamA.push({
          ...goalkeepers[0],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        teamB.push({
          ...goalkeepers[1],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
      } else {
        // Equipo B tiene menor nivel, darle el mejor arquero
        teamB.push({
          ...goalkeepers[0],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        teamA.push({
          ...goalkeepers[1],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
      }

      console.log(`✅ Asignado un arquero a cada equipo`);

      // Si hay arqueros adicionales, convertirlos en jugadores de campo
      if (goalkeepers.length > 2) {
        for (let i = 2; i < goalkeepers.length; i++) {
          wildcards.push(goalkeepers[i]);
        }
        console.log(
          `ℹ️ ${
            goalkeepers.length - 2
          } arqueros adicionales movidos a comodines`
        );
      }
    }
    // Solo hay un arquero disponible
    else if (goalkeepers.length === 1) {
      const metricsA = calculateTeamMetrics(teamA);
      const metricsB = calculateTeamMetrics(teamB);

      // Asignar el único arquero al equipo con menor nivel para equilibrar
      if (metricsA.skillAvg <= metricsB.skillAvg) {
        teamA.push({
          ...goalkeepers[0],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        console.log(`✅ Único arquero asignado al equipo A (menor nivel)`);
      } else {
        teamB.push({
          ...goalkeepers[0],
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        console.log(`✅ Único arquero asignado al equipo B (menor nivel)`);
      }
    }
    // No hay arqueros disponibles
    else {
      console.log(`⚠️ No hay arqueros disponibles para distribuir`);

      // Buscar comodines que puedan ser asignados como arqueros
      const availableWildcards = wildcards.filter((player) =>
        player.playerRoles?.includes(PLAYER_ROLES.WILDCARD)
      );

      if (availableWildcards.length >= 2) {
        // Asignar dos comodines como arqueros
        const metricsA = calculateTeamMetrics(teamA);
        const metricsB = calculateTeamMetrics(teamB);

        // Ordenar comodines por habilidad
        availableWildcards.sort(
          (a, b) => (b.starRating || 3) - (a.starRating || 3)
        );

        if (metricsA.skillAvg <= metricsB.skillAvg) {
          // Equipo A tiene menor nivel, darle el mejor comodín como arquero
          teamA.push({
            ...availableWildcards[0],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          teamB.push({
            ...availableWildcards[1],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
        } else {
          // Equipo B tiene menor nivel, darle el mejor comodín como arquero
          teamB.push({
            ...availableWildcards[0],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          teamA.push({
            ...availableWildcards[1],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
        }

        // Remover los comodines asignados como arqueros de la lista de wildcards
        const assignedIds = [
          availableWildcards[0].id,
          availableWildcards[1].id,
        ];
        for (let i = wildcards.length - 1; i >= 0; i--) {
          if (assignedIds.includes(wildcards[i].id)) {
            wildcards.splice(i, 1);
          }
        }

        console.log(`✅ Asignados 2 comodines como arqueros (uno por equipo)`);
      } else if (availableWildcards.length === 1) {
        // Solo hay un comodín disponible
        const metricsA = calculateTeamMetrics(teamA);
        const metricsB = calculateTeamMetrics(teamB);

        if (metricsA.skillAvg <= metricsB.skillAvg) {
          teamA.push({
            ...availableWildcards[0],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          console.log(
            `✅ Único comodín asignado como arquero al equipo A (menor nivel)`
          );
        } else {
          teamB.push({
            ...availableWildcards[0],
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          console.log(
            `✅ Único comodín asignado como arquero al equipo B (menor nivel)`
          );
        }

        // Remover el comodín asignado de la lista de wildcards
        const assignedIndex = wildcards.findIndex(
          (w) => w.id === availableWildcards[0].id
        );
        if (assignedIndex !== -1) {
          wildcards.splice(assignedIndex, 1);
        }
      } else {
        console.log(
          `⚠️ No hay comodines disponibles para asignar como arqueros`
        );
      }
    }

    // Limpiar la lista de arqueros después de procesarlos
    playersByPosition[PLAYER_ROLES.GOALKEEPER] = [];
  };

  // Ejecutar distribución de arqueros primero
  distributeGoalkeepers();

  // MEJORA 2: Distribuir jugadores top de cada posición
  // Asegurar que los jugadores más habilidosos de cada posición se repartan equitativamente
  const distributeTopPlayersForPosition = (position: string) => {
    const players = playersByPosition[position] || [];
    if (players.length < 2) return;

    // Ordenar por habilidad (mayor a menor)
    players.sort((a, b) => (b.starRating || 3) - (a.starRating || 3));

    // Seleccionar los 2 mejores de la posición
    const topPlayers = players.slice(0, 2);

    // Medir métricas actuales
    const metricsA = calculateTeamMetrics(teamA);
    const metricsB = calculateTeamMetrics(teamB);

    // Distribuir para equilibrar nivel de habilidad de manera más inteligente
    // Considerar tanto habilidad como edad en la distribución inicial
    const playerA_Score =
      (topPlayers[0].starRating || 3) * 0.7 +
      ((topPlayers[0].age || 30) / 50) * 0.3;
    const playerB_Score =
      (topPlayers[1].starRating || 3) * 0.7 +
      ((topPlayers[1].age || 30) / 50) * 0.3;

    // Asignar el mejor jugador al equipo que más lo necesite
    const teamA_NeedScore =
      (5 - metricsA.skillAvg) * 0.6 + ((40 - metricsA.ageAvg) / 40) * 0.4;
    const teamB_NeedScore =
      (5 - metricsB.skillAvg) * 0.6 + ((40 - metricsB.ageAvg) / 40) * 0.4;

    if (teamA_NeedScore >= teamB_NeedScore) {
      // Equipo A necesita más refuerzo
      if (playerA_Score >= playerB_Score) {
        teamA.push({ ...topPlayers[0], assignedRole: position });
        teamB.push({ ...topPlayers[1], assignedRole: position });
      } else {
        teamA.push({ ...topPlayers[1], assignedRole: position });
        teamB.push({ ...topPlayers[0], assignedRole: position });
      }
    } else {
      // Equipo B necesita más refuerzo
      if (playerA_Score >= playerB_Score) {
        teamB.push({ ...topPlayers[0], assignedRole: position });
        teamA.push({ ...topPlayers[1], assignedRole: position });
      } else {
        teamB.push({ ...topPlayers[1], assignedRole: position });
        teamA.push({ ...topPlayers[0], assignedRole: position });
      }
    }

    // Eliminar los jugadores asignados del pool
    playersByPosition[position] = players.slice(2);
  };

  // Distribuir primero los mejores jugadores de cada posición clave
  [
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
  ].forEach((position) => distributeTopPlayersForPosition(position));

  // Asignar jugadores por posición siguiendo el orden para los restantes
  positionOrder.forEach((position) => {
    if (position === PLAYER_ROLES.GOALKEEPER) return; // Ya procesado

    const players = playersByPosition[position] || [];
    if (players.length === 0) return;

    // Determinar cuántos jugadores necesitamos por equipo para esta posición
    let requiredPerTeam = 1; // Por defecto al menos 1
    if (position === PLAYER_ROLES.DEFENDER) requiredPerTeam = 4;
    if (position === PLAYER_ROLES.MIDFIELDER) requiredPerTeam = 3;
    if (position === PLAYER_ROLES.FORWARD) requiredPerTeam = 3;

    // Distribuir considerando balance de habilidad, edad y posición
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      // Calcular métricas actuales
      const metricsA = calculateTeamMetrics(teamA);
      const metricsB = calculateTeamMetrics(teamB);

      // MEJORA 3: Considerar múltiples factores para la asignación con pesos
      // Análisis de desbalances
      const skillDiff = metricsA.skillAvg - metricsB.skillAvg;
      const ageDiff = metricsA.ageAvg - metricsB.ageAvg;
      const positionCountA = metricsA.roleCounts[position] || 0;
      const positionCountB = metricsB.roleCounts[position] || 0;
      const positionDiff = positionCountA - positionCountB;

      // Puntaje para cada equipo (menor es mejor para asignar)
      // Combinamos factores con pesos:
      // - Diferencia de habilidad: 60%
      // - Diferencia de edad: 25%
      // - Diferencia de posiciones: 15%
      const scoreA = skillDiff * 0.6 + ageDiff * 0.25 + positionDiff * 0.15;

      // MEJORA 4: Evitar que la diferencia de edad sea muy grande
      const isBigAgeDiff = Math.abs(ageDiff) > 4; // Reducido de 7 a 4 años

      // MEJORA 5: Evitar diferencias extremas de habilidad
      const hasSkillImbalance = Math.abs(skillDiff) > 0.5; // Reducido de 0.8 a 0.5

      // Decisión final - asignar al equipo más necesitado
      if (isBigAgeDiff) {
        // Priorizar balanceo de edad si hay gran diferencia
        if (ageDiff > 0) {
          teamB.push({ ...player, assignedRole: position });
        } else {
          teamA.push({ ...player, assignedRole: position });
        }
      } else if (hasSkillImbalance) {
        // Priorizar balanceo de habilidad si hay gran diferencia
        if (skillDiff > 0) {
          teamB.push({ ...player, assignedRole: position });
        } else {
          teamA.push({ ...player, assignedRole: position });
        }
      } else {
        // Consideración combinada
        if (scoreA > 0) {
          teamB.push({ ...player, assignedRole: position });
        } else {
          teamA.push({ ...player, assignedRole: position });
        }
      }
    }
  });

  // MEJORA 6: Distribuir comodines considerando balance general
  // Hacer varias pasadas para asegurar el mejor balance
  while (wildcards.length > 0) {
    const player = wildcards.shift();
    if (!player) break;

    const metricsA = calculateTeamMetrics(teamA);
    const metricsB = calculateTeamMetrics(teamB);

    // Determinar qué posición asignar al comodín según lo que falte en cada equipo
    const determineRole = (team: Member[]) => {
      const metrics = calculateTeamMetrics(team);

      // Contar cuántas posiciones de cada tipo hay
      const gkCount = metrics.roleCounts[PLAYER_ROLES.GOALKEEPER] || 0;
      const defCount = metrics.roleCounts[PLAYER_ROLES.DEFENDER] || 0;
      const midCount = metrics.roleCounts[PLAYER_ROLES.MIDFIELDER] || 0;
      const fwdCount = metrics.roleCounts[PLAYER_ROLES.FORWARD] || 0;

      // Asignar a la posición más necesitada, priorizando de atrás hacia adelante
      if (gkCount < MAX_GOALKEEPERS_PER_TEAM) return PLAYER_ROLES.GOALKEEPER;

      // Para las demás posiciones, usar el sistema flexible que prioriza defensor > mediocampo > delantero
      const availableRoles = [
        PLAYER_ROLES.DEFENDER,
        PLAYER_ROLES.MIDFIELDER,
        PLAYER_ROLES.FORWARD,
      ];
      return assignFlexibleRole(team, availableRoles);
    };

    // Calcular puntajes de necesidad con pesos ajustados
    const skillDiff = metricsA.skillAvg - metricsB.skillAvg;
    const ageDiff = metricsA.ageAvg - metricsB.ageAvg;
    const teamSizeDiff = teamA.length - teamB.length;

    // Puntaje compuesto mejorado (mayor valor favorece al equipo B)
    // Aumentamos el peso de habilidad y edad para mejor balance
    const compositeScore = skillDiff * 0.6 + ageDiff * 0.3 + teamSizeDiff * 0.1;

    // Factor de corrección adicional para evitar desbalances extremos
    const skillImbalanceFactor =
      Math.abs(skillDiff) > 0.3 ? Math.sign(skillDiff) * 0.5 : 0;
    const ageImbalanceFactor =
      Math.abs(ageDiff) > 3 ? Math.sign(ageDiff) * 0.3 : 0;

    const adjustedScore =
      compositeScore + skillImbalanceFactor + ageImbalanceFactor;

    // Asignar al equipo más necesitado usando el puntaje ajustado
    if (
      adjustedScore > 0.05 ||
      (Math.abs(adjustedScore) <= 0.05 && teamA.length > teamB.length)
    ) {
      // Favorecer equipo B
      const roleToAssign = determineRole(teamB);
      teamB.push({ ...player, assignedRole: roleToAssign });
    } else {
      // Favorecer equipo A
      const roleToAssign = determineRole(teamA);
      teamA.push({ ...player, assignedRole: roleToAssign });
    }
  }

  // 3. ITERACIÓN DE BALANCEO GLOBAL
  const maxIterations = 10;
  let currentIteration = 0;

  // MEJORA 7: Verificar y corregir desbalances críticos
  const fixCriticalImbalances = () => {
    const metricsA = calculateTeamMetrics(teamA);
    const metricsB = calculateTeamMetrics(teamB);

    // 1. PRIORIDAD MÁXIMA: Verificar que cada equipo tenga exactamente un arquero si hay suficientes
    const gkCountA = metricsA.roleCounts[PLAYER_ROLES.GOALKEEPER] || 0;
    const gkCountB = metricsB.roleCounts[PLAYER_ROLES.GOALKEEPER] || 0;

    // Caso crítico: un equipo tiene 2+ arqueros y el otro ninguno
    if (gkCountA >= 2 && gkCountB === 0) {
      console.log(
        '🚨 Corrigiendo desbalance crítico de arqueros: Team A tiene varios, Team B ninguno'
      );
      // Mover un arquero del equipo A al B
      for (let i = 0; i < teamA.length; i++) {
        if (teamA[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          const gk = teamA.splice(i, 1)[0];
          teamB.push(gk);
          console.log(
            `✅ Movido arquero ${
              gk.name || 'sin nombre'
            } de equipo A a equipo B`
          );
          break;
        }
      }
    } else if (gkCountB >= 2 && gkCountA === 0) {
      console.log(
        '🚨 Corrigiendo desbalance crítico de arqueros: Team B tiene varios, Team A ninguno'
      );
      // Mover un arquero del equipo B al A
      for (let i = 0; i < teamB.length; i++) {
        if (teamB[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          const gk = teamB.splice(i, 1)[0];
          teamA.push(gk);
          console.log(
            `✅ Movido arquero ${
              gk.name || 'sin nombre'
            } de equipo B a equipo A`
          );
          break;
        }
      }
    }

    // Caso secundario: un equipo tiene varios arqueros (pero el otro ya tiene al menos uno)
    if (gkCountA > 1 && gkCountB >= 1) {
      console.log('⚠️ Ajustando exceso de arqueros en equipo A');
      // Mover arqueros excedentes a otra posición
      let extraGKs = 0;
      for (let i = 0; i < teamA.length && extraGKs < gkCountA - 1; i++) {
        if (teamA[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          // Reasignar a una posición con menos jugadores
          const counts = metricsA.roleCounts;
          let newRole = PLAYER_ROLES.DEFENDER;

          // Encontrar la posición con menos jugadores
          if (
            (counts[PLAYER_ROLES.MIDFIELDER] || 0) <
            (counts[PLAYER_ROLES.DEFENDER] || 0)
          ) {
            newRole = PLAYER_ROLES.MIDFIELDER;
          }
          if ((counts[PLAYER_ROLES.FORWARD] || 0) < (counts[newRole] || 0)) {
            newRole = PLAYER_ROLES.FORWARD;
          }

          teamA[i].assignedRole = newRole;
          extraGKs++;
          console.log(`🔄 Reasignado arquero extra de equipo A a ${newRole}`);
        }
      }
    } else if (gkCountB > 1 && gkCountA >= 1) {
      console.log('⚠️ Ajustando exceso de arqueros en equipo B');
      // Mover arqueros excedentes a otra posición
      let extraGKs = 0;
      for (let i = 0; i < teamB.length && extraGKs < gkCountB - 1; i++) {
        if (teamB[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          // Reasignar a una posición con menos jugadores
          const counts = metricsB.roleCounts;
          let newRole = PLAYER_ROLES.DEFENDER;

          // Encontrar la posición con menos jugadores
          if (
            (counts[PLAYER_ROLES.MIDFIELDER] || 0) <
            (counts[PLAYER_ROLES.DEFENDER] || 0)
          ) {
            newRole = PLAYER_ROLES.MIDFIELDER;
          }
          if ((counts[PLAYER_ROLES.FORWARD] || 0) < (counts[newRole] || 0)) {
            newRole = PLAYER_ROLES.FORWARD;
          }

          teamB[i].assignedRole = newRole;
          extraGKs++;
          console.log(`🔄 Reasignado arquero extra de equipo B a ${newRole}`);
        }
      }
    }

    // Caso extremo: ningún equipo tiene arquero pero hay jugadores que podrían ser arqueros
    if (gkCountA === 0 && gkCountB === 0) {
      console.log(
        '🚨 Ningún equipo tiene arquero, buscando jugadores para asignar'
      );

      // Buscar jugadores con rol de arquero en sus playerRoles pero no asignados como arqueros
      const findPotentialGK = (team: Member[]) => {
        return team.findIndex(
          (p) =>
            p.playerRoles?.some(
              (role) => role.role === PLAYER_ROLES.GOALKEEPER
            ) && p.assignedRole !== PLAYER_ROLES.GOALKEEPER
        );
      };

      // Buscar jugadores comodín que puedan ser asignados como arqueros
      const findWildcardForGK = (team: Member[]) => {
        return team.findIndex(
          (p) =>
            p.playerRoles?.some(
              (role) => role.role === PLAYER_ROLES.WILDCARD
            ) && p.assignedRole !== PLAYER_ROLES.GOALKEEPER
        );
      };

      // Intentar primero con el equipo A
      let gkIndex = findPotentialGK(teamA);
      if (gkIndex !== -1) {
        teamA[gkIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
        console.log(
          `✅ Asignado jugador de equipo A como arquero: ${
            teamA[gkIndex].name || 'sin nombre'
          }`
        );
      } else {
        // Si no hay arqueros específicos, buscar comodines
        gkIndex = findWildcardForGK(teamA);
        if (gkIndex !== -1) {
          teamA[gkIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
          console.log(
            `✅ Asignado comodín de equipo A como arquero: ${
              teamA[gkIndex].name || 'sin nombre'
            }`
          );
        }
      }

      // Luego con el equipo B
      gkIndex = findPotentialGK(teamB);
      if (gkIndex !== -1) {
        teamB[gkIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
        console.log(
          `✅ Asignado jugador de equipo B como arquero: ${
            teamB[gkIndex].name || 'sin nombre'
          }`
        );
      } else {
        // Si no hay arqueros específicos, buscar comodines
        gkIndex = findWildcardForGK(teamB);
        if (gkIndex !== -1) {
          teamB[gkIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
          console.log(
            `✅ Asignado comodín de equipo B como arquero: ${
              teamB[gkIndex].name || 'sin nombre'
            }`
          );
        }
      }

      // Verificar si aún faltan arqueros después de buscar específicos y comodines
      const teamAHasGK = teamA.some(
        (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
      );
      const teamBHasGK = teamB.some(
        (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
      );

      // Si aún no hay arqueros, asignar un jugador aleatorio de cada equipo
      if (!teamAHasGK && teamA.length > 0) {
        const randomIndex = Math.floor(Math.random() * teamA.length);
        teamA[randomIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
        console.log(
          `⚠️ Asignado jugador aleatorio de equipo A como arquero: ${
            teamA[randomIndex].name || 'sin nombre'
          }`
        );
      }

      if (!teamBHasGK && teamB.length > 0) {
        const randomIndex = Math.floor(Math.random() * teamB.length);
        teamB[randomIndex].assignedRole = PLAYER_ROLES.GOALKEEPER;
        console.log(
          `⚠️ Asignado jugador aleatorio de equipo B como arquero: ${
            teamB[randomIndex].name || 'sin nombre'
          }`
        );
      }
    }

    // 2. Verificar desbalance extremo de habilidad
    const recalcMetricsA = calculateTeamMetrics(teamA);
    const recalcMetricsB = calculateTeamMetrics(teamB);
    const skillDiff = recalcMetricsA.skillAvg - recalcMetricsB.skillAvg;

    if (Math.abs(skillDiff) > 0.8) {
      // Intentar cambiar jugadores para equilibrar
      if (skillDiff > 0) {
        // Equipo A tiene más nivel, mover uno bueno al B y uno más bajo al A
        const highSkillPlayer = teamA
          .filter((p) => (p.starRating || 3) >= 4)
          .sort((a, b) => (b.starRating || 3) - (a.starRating || 3))[0];

        const lowSkillPlayer = teamB
          .filter((p) => (p.starRating || 3) <= 3)
          .sort((a, b) => (a.starRating || 3) - (b.starRating || 3))[0];

        if (highSkillPlayer && lowSkillPlayer) {
          // Intercambiar jugadores manteniendo la posición
          const highPos = highSkillPlayer.assignedRole;
          const lowPos = lowSkillPlayer.assignedRole;

          // Remover jugadores de sus equipos actuales
          const highSkillIndex = teamA.findIndex((p) => p === highSkillPlayer);
          if (highSkillIndex !== -1) teamA.splice(highSkillIndex, 1);

          const lowSkillIndex = teamB.findIndex((p) => p === lowSkillPlayer);
          if (lowSkillIndex !== -1) teamB.splice(lowSkillIndex, 1);

          // Añadir jugadores a los equipos opuestos
          teamB.push({ ...highSkillPlayer, assignedRole: highPos });
          teamA.push({ ...lowSkillPlayer, assignedRole: lowPos });
        }
      } else {
        // Equipo B tiene más nivel, mover uno bueno al A y uno más bajo al B
        const highSkillPlayer = teamB
          .filter((p) => (p.starRating || 3) >= 4)
          .sort((a, b) => (b.starRating || 3) - (a.starRating || 3))[0];

        const lowSkillPlayer = teamA
          .filter((p) => (p.starRating || 3) <= 3)
          .sort((a, b) => (a.starRating || 3) - (b.starRating || 3))[0];

        if (highSkillPlayer && lowSkillPlayer) {
          // Intercambiar jugadores manteniendo la posición
          const highPos = highSkillPlayer.assignedRole;
          const lowPos = lowSkillPlayer.assignedRole;

          // Remover jugadores de sus equipos actuales
          const highSkillIndex = teamB.findIndex((p) => p === highSkillPlayer);
          if (highSkillIndex !== -1) teamB.splice(highSkillIndex, 1);

          const lowSkillIndex = teamA.findIndex((p) => p === lowSkillPlayer);
          if (lowSkillIndex !== -1) teamA.splice(lowSkillIndex, 1);

          // Añadir jugadores a los equipos opuestos
          teamA.push({ ...highSkillPlayer, assignedRole: highPos });
          teamB.push({ ...lowSkillPlayer, assignedRole: lowPos });
        }
      }
    }

    // 3. Verificar desbalance extremo de edad
    const ageDiff = recalcMetricsA.ageAvg - recalcMetricsB.ageAvg;
    if (Math.abs(ageDiff) > 7) {
      // Intentar intercambiar jugadores para reducir diferencia de edad
      if (ageDiff > 0) {
        // Equipo A tiene jugadores mayores, intercambiar uno mayor con uno joven del B
        const oldPlayer = teamA
          .filter((p) => p.age && p.age > recalcMetricsA.ageAvg)
          .sort((a, b) => (b.age || 0) - (a.age || 0))[0];

        const youngPlayer = teamB
          .filter((p) => p.age && p.age < recalcMetricsB.ageAvg)
          .sort((a, b) => (a.age || 99) - (b.age || 99))[0];

        if (oldPlayer && youngPlayer) {
          // Intercambiar jugadores intentando mantener la posición
          const oldPos = oldPlayer.assignedRole;
          const youngPos = youngPlayer.assignedRole;

          // Remover jugadores de sus equipos actuales
          const oldPlayerIndex = teamA.findIndex((p) => p === oldPlayer);
          if (oldPlayerIndex !== -1) teamA.splice(oldPlayerIndex, 1);

          const youngPlayerIndex = teamB.findIndex((p) => p === youngPlayer);
          if (youngPlayerIndex !== -1) teamB.splice(youngPlayerIndex, 1);

          // Si las posiciones son diferentes, intentar mantener el balance ajustando
          if (oldPos === youngPos || !oldPos || !youngPos) {
            teamB.push({ ...oldPlayer, assignedRole: oldPos });
            teamA.push({ ...youngPlayer, assignedRole: youngPos });
          } else {
            // Buscar jugadores de la misma posición para no desbalancear
            const oldPosSub = teamB.find((p) => p.assignedRole === oldPos);
            const youngPosSub = teamA.find((p) => p.assignedRole === youngPos);

            if (oldPosSub && youngPosSub) {
              // Podemos intercambiar manteniendo las posiciones balanceadas
              const oldPosSubIndex = teamB.findIndex((p) => p === oldPosSub);
              if (oldPosSubIndex !== -1) teamB.splice(oldPosSubIndex, 1);

              const youngPosSubIndex = teamA.findIndex(
                (p) => p === youngPosSub
              );
              if (youngPosSubIndex !== -1) teamA.splice(youngPosSubIndex, 1);

              teamB.push({ ...oldPlayer, assignedRole: oldPos });
              teamA.push({ ...youngPlayer, assignedRole: youngPos });
              teamA.push({ ...oldPosSub, assignedRole: oldPos });
              teamB.push({ ...youngPosSub, assignedRole: youngPos });
            } else {
              // No hay sustitutos, solo intercambiar con el riesgo de desbalancear posiciones
              teamB.push({ ...oldPlayer, assignedRole: oldPos });
              teamA.push({ ...youngPlayer, assignedRole: youngPos });
            }
          }
        }
      } else {
        // Equipo B tiene jugadores mayores, intercambiar uno mayor con uno joven del A
        const oldPlayer = teamB
          .filter((p) => p.age && p.age > recalcMetricsB.ageAvg)
          .sort((a, b) => (b.age || 0) - (a.age || 0))[0];

        const youngPlayer = teamA
          .filter((p) => p.age && p.age < recalcMetricsA.ageAvg)
          .sort((a, b) => (a.age || 99) - (b.age || 99))[0];

        if (oldPlayer && youngPlayer) {
          // Intercambiar jugadores intentando mantener la posición
          const oldPos = oldPlayer.assignedRole;
          const youngPos = youngPlayer.assignedRole;

          // Remover jugadores de sus equipos actuales
          const oldPlayerIndex = teamB.findIndex((p) => p === oldPlayer);
          if (oldPlayerIndex !== -1) teamB.splice(oldPlayerIndex, 1);

          const youngPlayerIndex = teamA.findIndex((p) => p === youngPlayer);
          if (youngPlayerIndex !== -1) teamA.splice(youngPlayerIndex, 1);

          // Si las posiciones son diferentes, intentar mantener el balance ajustando
          if (oldPos === youngPos || !oldPos || !youngPos) {
            teamA.push({ ...oldPlayer, assignedRole: oldPos });
            teamB.push({ ...youngPlayer, assignedRole: youngPos });
          } else {
            // Buscar jugadores de la misma posición para no desbalancear
            const oldPosSub = teamA.find((p) => p.assignedRole === oldPos);
            const youngPosSub = teamB.find((p) => p.assignedRole === youngPos);

            if (oldPosSub && youngPosSub) {
              // Podemos intercambiar manteniendo las posiciones balanceadas
              const oldPosSubIndex = teamA.findIndex((p) => p === oldPosSub);
              if (oldPosSubIndex !== -1) teamA.splice(oldPosSubIndex, 1);

              const youngPosSubIndex = teamB.findIndex(
                (p) => p === youngPosSub
              );
              if (youngPosSubIndex !== -1) teamB.splice(youngPosSubIndex, 1);

              teamA.push({ ...oldPlayer, assignedRole: oldPos });
              teamB.push({ ...youngPlayer, assignedRole: youngPos });
              teamB.push({ ...oldPosSub, assignedRole: oldPos });
              teamA.push({ ...youngPosSub, assignedRole: youngPos });
            } else {
              // No hay sustitutos, solo intercambiar con el riesgo de desbalancear posiciones
              teamA.push({ ...oldPlayer, assignedRole: oldPos });
              teamB.push({ ...youngPlayer, assignedRole: youngPos });
            }
          }
        }
      }
    }
  };

  // Ejecutar corrección de desbalances críticos
  fixCriticalImbalances();

  // NUEVA MEJORA: Verificación y corrección final de desbalances extremos
  const performFinalBalanceCheck = () => {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const metricsA = calculateTeamMetrics(teamA);
      const metricsB = calculateTeamMetrics(teamB);

      const skillDiff = Math.abs(metricsA.skillAvg - metricsB.skillAvg);
      const ageDiff = Math.abs(metricsA.ageAvg - metricsB.ageAvg);

      console.log(
        `🔍 Verificación final ${attempts + 1}: Skill diff: ${skillDiff.toFixed(
          2
        )}, Age diff: ${ageDiff.toFixed(1)}`
      );

      // Umbrales más estrictos para la verificación final
      const skillThreshold = 0.4; // Máximo 0.4 puntos de diferencia en rating
      const ageThreshold = 3.5; // Máximo 3.5 años de diferencia promedio

      if (skillDiff <= skillThreshold && ageDiff <= ageThreshold) {
        console.log('✅ Balance final aceptable alcanzado');
        break;
      }

      // Identificar el tipo de desbalance más crítico
      const skillImbalanceRatio = skillDiff / skillThreshold;
      const ageImbalanceRatio = ageDiff / ageThreshold;

      if (skillImbalanceRatio > ageImbalanceRatio) {
        // Priorizar corrección de habilidad
        console.log(
          `🔧 Corrigiendo desbalance de habilidad (${skillDiff.toFixed(2)})`
        );

        // Encontrar el mejor jugador del equipo con mayor rating
        const strongerTeam =
          metricsA.skillAvg > metricsB.skillAvg ? teamA : teamB;
        const weakerTeam =
          metricsA.skillAvg > metricsB.skillAvg ? teamB : teamA;

        // Buscar jugador de alto rating en el equipo fuerte (excluyendo arqueros)
        const highRatedPlayer = strongerTeam
          .filter((p) => p.assignedRole !== PLAYER_ROLES.GOALKEEPER)
          .sort((a, b) => (b.starRating || 3) - (a.starRating || 3))[0];

        // Buscar jugador de bajo rating en el equipo débil (excluyendo arqueros)
        const lowRatedPlayer = weakerTeam
          .filter((p) => p.assignedRole !== PLAYER_ROLES.GOALKEEPER)
          .sort((a, b) => (a.starRating || 3) - (b.starRating || 3))[0];

        if (highRatedPlayer && lowRatedPlayer) {
          // Intercambiar jugadores
          const highIndex = strongerTeam.findIndex(
            (p) => p.id === highRatedPlayer.id
          );
          const lowIndex = weakerTeam.findIndex(
            (p) => p.id === lowRatedPlayer.id
          );

          if (highIndex !== -1 && lowIndex !== -1) {
            // Mantener las posiciones asignadas
            const tempRole = highRatedPlayer.assignedRole;
            highRatedPlayer.assignedRole = lowRatedPlayer.assignedRole;
            lowRatedPlayer.assignedRole = tempRole;

            // Intercambiar
            strongerTeam[highIndex] = lowRatedPlayer;
            weakerTeam[lowIndex] = highRatedPlayer;

            console.log(
              `🔄 Intercambiado ${highRatedPlayer.name} (${highRatedPlayer.starRating}) ↔ ${lowRatedPlayer.name} (${lowRatedPlayer.starRating})`
            );
          }
        }
      } else {
        // Priorizar corrección de edad
        console.log(
          `🔧 Corrigiendo desbalance de edad (${ageDiff.toFixed(1)} años)`
        );

        // Encontrar el equipo con mayor edad promedio
        const olderTeam = metricsA.ageAvg > metricsB.ageAvg ? teamA : teamB;
        const youngerTeam = metricsA.ageAvg > metricsB.ageAvg ? teamB : teamA;

        // Buscar jugador mayor en el equipo viejo (excluyendo arqueros)
        const oldPlayer = olderTeam
          .filter((p) => p.assignedRole !== PLAYER_ROLES.GOALKEEPER && p.age)
          .sort((a, b) => (b.age || 0) - (a.age || 0))[0];

        // Buscar jugador joven en el equipo joven (excluyendo arqueros)
        const youngPlayer = youngerTeam
          .filter((p) => p.assignedRole !== PLAYER_ROLES.GOALKEEPER && p.age)
          .sort((a, b) => (a.age || 99) - (b.age || 99))[0];

        if (oldPlayer && youngPlayer) {
          // Intercambiar jugadores
          const oldIndex = olderTeam.findIndex((p) => p.id === oldPlayer.id);
          const youngIndex = youngerTeam.findIndex(
            (p) => p.id === youngPlayer.id
          );

          if (oldIndex !== -1 && youngIndex !== -1) {
            // Mantener las posiciones asignadas
            const tempRole = oldPlayer.assignedRole;
            oldPlayer.assignedRole = youngPlayer.assignedRole;
            youngPlayer.assignedRole = tempRole;

            // Intercambiar
            olderTeam[oldIndex] = youngPlayer;
            youngerTeam[youngIndex] = oldPlayer;

            console.log(
              `🔄 Intercambiado ${oldPlayer.name} (${oldPlayer.age} años) ↔ ${youngPlayer.name} (${youngPlayer.age} años)`
            );
          }
        }
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('⚠️ Se alcanzó el máximo de intentos de corrección final');
    }
  };

  // Ejecutar verificación y corrección final
  performFinalBalanceCheck();

  // Final: Calcular y mostrar métricas
  const finalMetricsA = calculateTeamMetrics(teamA);
  const finalMetricsB = calculateTeamMetrics(teamB);

  console.log('ALGORITMO MEJORADO - MÉTRICAS FINALES:');
  console.log('Equipo A:', {
    jugadores: teamA.length,
    promedioEdad: finalMetricsA.ageAvg.toFixed(1),
    promedioHabilidad: finalMetricsA.skillAvg.toFixed(2),
    roles: finalMetricsA.roleCounts,
  });
  console.log('Equipo B:', {
    jugadores: teamB.length,
    promedioEdad: finalMetricsB.ageAvg.toFixed(1),
    promedioHabilidad: finalMetricsB.skillAvg.toFixed(2),
    roles: finalMetricsB.roleCounts,
  });

  // Mostrar diferencias finales para verificación
  const finalSkillDiff = Math.abs(
    finalMetricsA.skillAvg - finalMetricsB.skillAvg
  );
  const finalAgeDiff = Math.abs(finalMetricsA.ageAvg - finalMetricsB.ageAvg);
  console.log('📊 DIFERENCIAS FINALES:', {
    habilidad: finalSkillDiff.toFixed(2),
    edad: finalAgeDiff.toFixed(1),
    balanceAceptable:
      finalSkillDiff <= 0.4 && finalAgeDiff <= 3.5 ? '✅' : '⚠️',
  });

  // Aplicar balance final de posiciones a ambos equipos
  teamA = balanceTeamPositions(teamA);
  teamB = balanceTeamPositions(teamB);

  return [teamA, teamB];
};

// Función para ordenar jugadores por rol (versión mejorada)
const sortPlayersByRole = (players: any[]) => {
  if (!players || !Array.isArray(players)) return players;

  // Crear una copia para no modificar el original
  const result = [...players];

  // Agrupar jugadores por su rol asignado
  const playersByRole: Record<string, any[]> = {
    [PLAYER_ROLES.GOALKEEPER]: [],
    [PLAYER_ROLES.DEFENDER]: [],
    [PLAYER_ROLES.MIDFIELDER]: [],
    [PLAYER_ROLES.FORWARD]: [],
    other: [],
  };

  // Clasificar cada jugador en su grupo correspondiente
  result.forEach((player) => {
    // 1. Verificar si hay un rol asignado explícitamente
    if (player.assignedRole) {
      if (player.assignedRole === PLAYER_ROLES.GOALKEEPER) {
        playersByRole[PLAYER_ROLES.GOALKEEPER].push(player);
      } else if (player.assignedRole === PLAYER_ROLES.DEFENDER) {
        playersByRole[PLAYER_ROLES.DEFENDER].push(player);
      } else if (player.assignedRole === PLAYER_ROLES.MIDFIELDER) {
        playersByRole[PLAYER_ROLES.MIDFIELDER].push(player);
      } else if (player.assignedRole === PLAYER_ROLES.FORWARD) {
        playersByRole[PLAYER_ROLES.FORWARD].push(player);
      } else {
        playersByRole.other.push(player);
      }
    }
    // 2. Si no hay rol asignado pero hay roles preferidos, usar el principal
    else if (
      player.playerRoles &&
      Array.isArray(player.playerRoles) &&
      player.playerRoles.length > 0
    ) {
      const primaryRole = getPrimaryRole(player.playerRoles);

      if (primaryRole === PLAYER_ROLES.GOALKEEPER) {
        playersByRole[PLAYER_ROLES.GOALKEEPER].push({
          ...player,
          assignedRole: primaryRole,
        });
      } else if (primaryRole === PLAYER_ROLES.DEFENDER) {
        playersByRole[PLAYER_ROLES.DEFENDER].push({
          ...player,
          assignedRole: primaryRole,
        });
      } else if (primaryRole === PLAYER_ROLES.MIDFIELDER) {
        playersByRole[PLAYER_ROLES.MIDFIELDER].push({
          ...player,
          assignedRole: primaryRole,
        });
      } else if (primaryRole === PLAYER_ROLES.FORWARD) {
        playersByRole[PLAYER_ROLES.FORWARD].push({
          ...player,
          assignedRole: primaryRole,
        });
      } else {
        playersByRole.other.push(player);
      }
    }
    // 3. Sin información de rol
    else {
      playersByRole.other.push(player);
    }
  });

  // Combinar en el orden correcto: arquero, defensor, mediocampista, delantero
  const sortedPlayers = [
    ...playersByRole[PLAYER_ROLES.GOALKEEPER],
    ...playersByRole[PLAYER_ROLES.DEFENDER],
    ...playersByRole[PLAYER_ROLES.MIDFIELDER],
    ...playersByRole[PLAYER_ROLES.FORWARD],
    ...playersByRole.other,
  ];

  console.log(
    '👥 Jugadores ordenados por posición:',
    sortedPlayers.length,
    'jugadores',
    sortedPlayers.map((p) => ({
      name: p.name,
      assignedRole: p.assignedRole || 'sin rol',
    }))
  );

  return sortedPlayers;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticación usando la misma lógica que funciona en otros endpoints
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    console.log('No authenticated session found in /api/matches/create-match');
    return res.status(401).json({ message: 'No autenticado' });
  }

  const userId = session.user.id;
  console.log('User ID from session in /api/matches/create-match:', userId);

  // Buscar el usuario en la base de datos para confirmar que existe
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
      balanceByRole = true, // Por defecto true si no se especifica
      balanceByRating = false, // Por defecto false si no se especifica
      teamA = null,
      teamB = null,
      mode = 'auto', // 'auto' para sorteo automático, 'manual' para equipos manuales
      matchId = null, // ID del partido existente (para resort)
      isResort = false, // Indica si es un re-sorteo de un partido existente
      players = [], // Lista de jugadores proporcionada para el sorteo
      tbdPlayersInput = { teamA: [], teamB: [] }, // Jugadores TBD predefinidos
      allowTbdPlayers: allowTbdPlayersParam = true, // Por defecto permitir TBD players si no se especifica
      useRandomAlgorithm = false, // Parámetro para usar algoritmo completamente aleatorio
    } = req.body;

    // Crear variable mutable para allowTbdPlayers
    let allowTbdPlayers = allowTbdPlayersParam;

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

      // DETECTAR SI ES REALMENTE LA PRIMERA VEZ basándose en sortCount
      const actuallyFirstTime =
        !existingMatch.sortCount || existingMatch.sortCount === 0;
      if (actuallyFirstTime) {
        console.log(
          '🎯 PRIMERA VEZ sorteando equipos (sortCount = 0), generando TBD players'
        );
      } else {
        console.log(
          `🎯 RE-SORTEO de equipos (sortCount = ${existingMatch.sortCount})`
        );
      }

      // Sobrescribir allowTbdPlayers para primera vez - siempre generar TBD la primera vez
      if (actuallyFirstTime) {
        allowTbdPlayers = true;
        console.log('🎯 Forzando allowTbdPlayers = true para primera vez');
      } else {
        // CORREGIDO: También forzar TBD players en re-sorteos si allowTbdPlayers es true desde el frontend
        // Esto asegura que los jugadores TBD se generen consistentemente
        if (allowTbdPlayersParam === true) {
          allowTbdPlayers = true;
          console.log('🎯 Manteniendo allowTbdPlayers = true para re-sorteo');
        }
      }

      // NUEVO: Log detallado del estado de allowTbdPlayers después de configuración
      console.log('🔍 Estado final de allowTbdPlayers:', {
        allowTbdPlayersParam,
        allowTbdPlayers,
        actuallyFirstTime,
        sortCount: existingMatch?.sortCount,
        isResort,
        matchId,
      });

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

      // Obtener los roles de los jugadores del partido
      const matchData = await prisma.match.findUnique({
        where: { id: matchId },
        select: { tbdPlayers: true },
      });

      // Extraer los roles de los jugadores del partido
      let playerRolesData: Record<string, string[]> = {};
      let assignedRolesData: Record<string, string> = {};

      if (matchData?.tbdPlayers) {
        const tbdPlayersData =
          typeof matchData.tbdPlayers === 'string'
            ? JSON.parse(matchData.tbdPlayers as string)
            : matchData.tbdPlayers;

        if (
          tbdPlayersData.playerRoles &&
          typeof tbdPlayersData.playerRoles === 'object'
        ) {
          playerRolesData = tbdPlayersData.playerRoles;
        }

        if (
          tbdPlayersData.assignedRoles &&
          typeof tbdPlayersData.assignedRoles === 'object'
        ) {
          assignedRolesData = tbdPlayersData.assignedRoles;
        }
      }

      previousTeams = {
        teamA: previousMatchPlayers
          .filter((p: { isTeamA: boolean }) => p.isTeamA)
          .map((p: { userId: string; user: { name: string | null } }) => {
            const playerRole = playerRolesData[p.userId] || [];
            const assignedRole = assignedRolesData[p.userId];
            return {
              id: p.userId,
              name: p.user.name,
              playerRoles: playerRole,
              assignedRole: assignedRole,
              role:
                assignedRole || getPrimaryRole(playerRole) || 'No especificado',
            };
          }),
        teamB: previousMatchPlayers
          .filter((p: { isTeamA: boolean }) => !p.isTeamA)
          .map((p: { userId: string; user: { name: string | null } }) => {
            const playerRole = playerRolesData[p.userId] || [];
            const assignedRole = assignedRolesData[p.userId];
            return {
              id: p.userId,
              name: p.user.name,
              playerRoles: playerRole,
              assignedRole: assignedRole,
              role:
                assignedRole || getPrimaryRole(playerRole) || 'No especificado',
            };
          }),
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
    if (mode === 'auto') {
      let confirmedPlayersCount = 0;

      if (players && players.length > 0) {
        // Si se proporcionaron jugadores en la request, usar esa cantidad
        confirmedPlayersCount = players.length;
      } else if (isResort && matchId) {
        // Si es un resorteo, obtener jugadores confirmados de asistencia
        const confirmedAttendance = await prisma.matchAttendance.findMany({
          where: {
            matchId,
            status: 'CONFIRMED',
          },
        });
        confirmedPlayersCount = confirmedAttendance.length;
      } else {
        // Fallback: obtener jugadores desde matchPlayer
        const confirmedMembers = await prisma.matchPlayer.findMany({
          where: {
            matchId,
            match: {
              groupId,
            },
          },
        });
        confirmedPlayersCount = confirmedMembers.length;
      }

      console.log('Verificando jugadores confirmados:', {
        confirmedPlayersCount,
        hasPlayers: players && players.length > 0,
        isResort,
        matchId,
      });

      if (confirmedPlayersCount < 2) {
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

    // Remover log temporal - mover a lugar correcto

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

    // Variable para almacenar datos de usuario (incluyendo avatares)
    let allUsersData: {
      id: string;
      name: string | null;
      birthdate: Date | null;
      image: string | null;
    }[] = [];

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
        // Obtener datos completos de usuarios para asegurar que tenemos edades exactas
        const userIds = players.map((player: any) => player.userId);

        // Fetch GroupMember data to get starRating
        const groupMembers = await prisma.groupMember.findMany({
          where: {
            groupId,
            userId: {
              in: userIds,
            },
          },
          select: {
            userId: true,
            starRating: true,
          },
        });

        // Create a map for quick access to star ratings
        const starRatingsMap: Record<string, number | null> = {};
        groupMembers.forEach(
          (member: { userId: string; starRating: number | null }) => {
            starRatingsMap[member.userId] = member.starRating;
          }
        );

        allUsersData = await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            name: true,
            birthdate: true,
            image: true, // Include avatar/image field
          },
        });

        // Crear un mapa para acceso rápido a los datos de usuario
        const userDataMap = allUsersData.reduce(
          (
            map: Record<string, any>,
            user: { id: string; name: string | null; birthdate: Date | null }
          ) => {
            map[user.id] = user;
            return map;
          },
          {} as Record<string, any>
        );

        // Usar los jugadores proporcionados en la solicitud, pero con datos actualizados
        mappedMembers = players
          .filter((player: any) => player && player.userId) // Ensure player has userId
          .map((player: any) => {
            const userData = userDataMap[player.userId] || {};
            return {
              id: player.userId,
              name: player.name || userData.name || 'Jugador',
              birthdate: userData.birthdate || null,
              age: userData.birthdate
                ? calculateAge(userData.birthdate)
                : player.age,
              role: 'MEMBER',
              playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD],
              starRating:
                player.starRating !== undefined
                  ? player.starRating
                  : starRatingsMap[player.userId] || 3,
            };
          });
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

          // Fetch GroupMember data to get starRating
          const userIds = confirmedAttendance.map(
            (attendance: any) => attendance.user.id
          );
          const groupMembers = await prisma.groupMember.findMany({
            where: {
              groupId,
              userId: {
                in: userIds,
              },
            },
            select: {
              userId: true,
              starRating: true,
            },
          });

          // Create a map for quick access to star ratings
          const starRatingsMap: Record<string, number | null> = {};
          groupMembers.forEach(
            (member: { userId: string; starRating: number | null }) => {
              starRatingsMap[member.userId] = member.starRating;
            }
          );

          // Obtener los roles de los jugadores desde el match
          const matchData = await prisma.match.findUnique({
            where: { id: matchId },
            select: { tbdPlayers: true },
          });

          let playerRoles: Record<string, PlayerRole[]> = {};
          if (matchData?.tbdPlayers) {
            const tbdPlayers =
              typeof matchData.tbdPlayers === 'string'
                ? JSON.parse(matchData.tbdPlayers as string)
                : matchData.tbdPlayers;

            if (
              tbdPlayers.playerRoles &&
              typeof tbdPlayers.playerRoles === 'object'
            ) {
              // Normalizar cada entrada de playerRoles para manejar formato antiguo y nuevo
              const rawPlayerRoles = tbdPlayers.playerRoles as Record<
                string,
                any
              >;
              for (const [userId, roles] of Object.entries(rawPlayerRoles)) {
                playerRoles[userId] = normalizePlayerRoles(roles);
              }
            }
          }

          mappedMembers = confirmedAttendance
            .filter(
              (attendance: any) =>
                attendance && attendance.user && attendance.user.id
            )
            .map(
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
                // Obtener los roles del jugador si existen, con valor por defecto
                playerRoles: playerRoles[attendance.user.id] || [
                  { role: PLAYER_ROLES.WILDCARD, priority: 1 },
                ],
                starRating: starRatingsMap[attendance.user.id] || 3,
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

        // Fetch GroupMember data to get starRating
        const groupMembers = await prisma.groupMember.findMany({
          where: {
            groupId,
            userId: {
              in: confirmedUserIds,
            },
          },
          select: {
            userId: true,
            starRating: true,
          },
        });

        // Create a map for quick access to star ratings
        const starRatingsMap: Record<string, number | null> = {};
        groupMembers.forEach(
          (member: { userId: string; starRating: number | null }) => {
            starRatingsMap[member.userId] = member.starRating;
          }
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
            image: true, // Include avatar/image field
          },
        });

        // Mapear los datos de usuarios
        mappedMembers = usersData
          .filter((user: any) => user && user.id)
          .map(
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
              starRating: starRatingsMap[user.id] || 3,
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
          primaryRole: getPrimaryRole(m.playerRoles),
        }))
      );

      // Log específico para arqueros
      const goalkeepers = mappedMembers.filter((m) => {
        const primaryRole = getPrimaryRole(m.playerRoles);
        return primaryRole === PLAYER_ROLES.GOALKEEPER;
      });
      console.log(
        'Jugadores que eligieron ARQUERO como prioridad 1:',
        goalkeepers.map((g) => ({
          name: g.name,
          playerRoles: g.playerRoles,
        }))
      );

      // Filter out any undefined or null members to prevent errors
      mappedMembers = mappedMembers.filter((member) => member && member.id);

      // Obtener datos de usuario (incluyendo avatares) para todos los jugadores
      const allPlayerIds = mappedMembers.map((player) => player.id);
      if (allPlayerIds.length > 0) {
        allUsersData = await prisma.user.findMany({
          where: {
            id: {
              in: allPlayerIds,
            },
          },
          select: {
            id: true,
            name: true,
            birthdate: true,
            image: true,
          },
        });
      }

      // Función para verificar y corregir el balance de jugadores reales entre equipos
      const ensureEvenRealPlayerDistribution = (
        teamA: Member[],
        teamB: Member[]
      ): [Member[], Member[]] => {
        // Identificar jugadores reales vs TBD en cada equipo
        const realPlayersA = teamA.filter(
          (p) => p && p.id && !p.id.toString().startsWith('tbd-')
        );
        const tbdPlayersA = teamA.filter(
          (p) => p && p.id && p.id.toString().startsWith('tbd-')
        );
        const realPlayersB = teamB.filter(
          (p) => p && p.id && !p.id.toString().startsWith('tbd-')
        );
        const tbdPlayersB = teamB.filter(
          (p) => p && p.id && p.id.toString().startsWith('tbd-')
        );

        // Verificar si hay desbalance de jugadores reales
        const realPlayerDiff = Math.abs(
          realPlayersA.length - realPlayersB.length
        );

        if (realPlayerDiff > 1) {
          console.log(
            `Corrigiendo desbalance de jugadores reales: A=${realPlayersA.length}, B=${realPlayersB.length}`
          );

          // Determinar qué equipo tiene más jugadores reales
          const sourceTeam =
            realPlayersA.length > realPlayersB.length
              ? realPlayersA
              : realPlayersB;
          const targetTeam =
            realPlayersA.length > realPlayersB.length
              ? realPlayersB
              : realPlayersA;
          const movingFromAtoB = realPlayersA.length > realPlayersB.length;

          // Calcular cuántos jugadores reales mover
          const playersToMove = Math.floor(realPlayerDiff / 2);

          // Realizar las transferencias
          for (let i = 0; i < playersToMove; i++) {
            if (sourceTeam.length > 0) {
              // Obtener un jugador para mover (aleatorio para evitar patrones)
              const playerIndex = Math.floor(Math.random() * sourceTeam.length);
              const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
              targetTeam.push(playerToMove);

              // Actualizar los arrays originales
              if (movingFromAtoB) {
                // Eliminar de A
                const indexInTeamA = teamA.findIndex(
                  (p) => p.id === playerToMove.id
                );
                if (indexInTeamA !== -1) {
                  teamA.splice(indexInTeamA, 1);
                  teamB.push(playerToMove);
                }
              } else {
                // Eliminar de B
                const indexInTeamB = teamB.findIndex(
                  (p) => p.id === playerToMove.id
                );
                if (indexInTeamB !== -1) {
                  teamB.splice(indexInTeamB, 1);
                  teamA.push(playerToMove);
                }
              }
            }
          }

          console.log(
            `Balance final de jugadores reales: A=${
              teamA.filter(
                (p) => p && p.id && !p.id.toString().startsWith('tbd-')
              ).length
            }, B=${
              teamB.filter(
                (p) => p && p.id && !p.id.toString().startsWith('tbd-')
              ).length
            }`
          );
        }

        return [teamA, teamB];
      };

      // Función para balancear equipos por edad
      const createBalancedTeams = (members: Member[]): [Member[], Member[]] => {
        // Primero agrupar jugadores por edad
        const playersByAge: Record<string, Member[]> = {};

        // Jugadores sin edad definida
        const playersWithoutAge: Member[] = [];

        // Clasificar jugadores por grupos de edad
        members.forEach((member) => {
          if (member.age !== null && member.age !== undefined) {
            const ageKey = member.age.toString();
            if (!playersByAge[ageKey]) {
              playersByAge[ageKey] = [];
            }
            playersByAge[ageKey].push(member);
          } else {
            playersWithoutAge.push(member);
          }
        });

        // Obtener las edades en orden descendente
        const ages = Object.keys(playersByAge)
          .map(Number)
          .sort((a, b) => b - a);

        const teamA: Member[] = [];
        const teamB: Member[] = [];

        // Para cada grupo de edad, mezclarlos aleatoriamente y luego distribuirlos
        ages.forEach((age) => {
          // Mezclar el grupo de jugadores de la misma edad
          const shuffledSameAge = [...playersByAge[age.toString()]].sort(
            () => Math.random() - 0.5
          );

          // Distribuir alternadamente
          shuffledSameAge.forEach((member, index) => {
            if (index % 2 === 0) {
              teamA.push(member);
            } else {
              teamB.push(member);
            }
          });
        });

        // Mezclar jugadores sin edad y distribuirlos
        const shuffledWithoutAge = [...playersWithoutAge].sort(
          () => Math.random() - 0.5
        );
        shuffledWithoutAge.forEach((member, index) => {
          if (index % 2 === 0) {
            teamA.push(member);
          } else {
            teamB.push(member);
          }
        });

        // NUEVO: Verificar y corregir el balance de jugadores reales
        return ensureEvenRealPlayerDistribution(teamA, teamB);
      };

      // Función para balancear equipos por nivel de habilidad (star rating)
      const createRatingBalancedTeams = (
        members: Member[]
      ): [Member[], Member[]] => {
        // Agrupar jugadores por niveles de rating similares
        const playersByRating: Record<number, Member[]> = {};

        // Clasificar jugadores por rating
        members.forEach((member) => {
          const rating =
            member.starRating !== undefined && member.starRating !== null
              ? Math.floor(member.starRating)
              : 3; // Rating por defecto si no está definido

          if (!playersByRating[rating]) {
            playersByRating[rating] = [];
          }
          playersByRating[rating].push(member);
        });

        // Obtener ratings en orden descendente
        const ratings = Object.keys(playersByRating)
          .map(Number)
          .sort((a, b) => b - a);

        let teamA: Member[] = [];
        let teamB: Member[] = [];

        // Para cada nivel de rating, mezclar y distribuir
        ratings.forEach((rating) => {
          // Mezclar jugadores con el mismo rating
          const shuffledSameRating = [...playersByRating[rating]].sort(
            () => Math.random() - 0.5
          );

          // Distribuir alternadamente
          shuffledSameRating.forEach((member, index) => {
            if (index % 2 === 0) {
              teamA.push(member);
            } else {
              teamB.push(member);
            }
          });
        });

        // Verificar y corregir el balance de jugadores reales
        // Aplicar balance final de posiciones a ambos equipos
        teamA = balanceTeamPositions(teamA);
        teamB = balanceTeamPositions(teamB);

        return [teamA, teamB];
      };

      // Función para balancear equipos por rol
      const createRoleBalancedTeams = (
        members: Member[]
      ): [Member[], Member[]] => {
        let teamA: Member[] = [];
        let teamB: Member[] = [];

        // Función para verificar si un jugador ya está en un equipo
        const isPlayerInTeam = (playerId: string, team: Member[]): boolean => {
          return team.some((player) => player.id === playerId);
        };

        // Función para añadir jugador solo si no está duplicado
        const addPlayerToTeam = (
          player: Member,
          team: Member[],
          assignedRole: string
        ): boolean => {
          if (
            !isPlayerInTeam(player.id, team) &&
            !isPlayerInTeam(player.id, teamA) &&
            !isPlayerInTeam(player.id, teamB)
          ) {
            team.push({ ...player, assignedRole });
            return true;
          }
          return false;
        };

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
        const availableWildcards = [
          ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
        ]; // Crear copia para evitar mutaciones

        if (goalkeepers.length >= 2) {
          // Si hay al menos 2 arqueros, distribuir uno a cada equipo
          const sortedGoalkeepers = [...goalkeepers].sort(
            () => Math.random() - 0.5
          );
          addPlayerToTeam(sortedGoalkeepers[0], teamA, PLAYER_ROLES.GOALKEEPER);
          addPlayerToTeam(sortedGoalkeepers[1], teamB, PLAYER_ROLES.GOALKEEPER);

          // Si hay más arqueros, añadirlos a la lista de sin rol para distribuirlos después
          if (goalkeepers.length > 2) {
            playersWithoutRole.push(...sortedGoalkeepers.slice(2));
          }
        } else if (goalkeepers.length === 1) {
          // Si solo hay un arquero, usar una moneda para decidir a qué equipo va
          if (Math.random() > 0.5) {
            addPlayerToTeam(goalkeepers[0], teamA, PLAYER_ROLES.GOALKEEPER);
          } else {
            addPlayerToTeam(goalkeepers[0], teamB, PLAYER_ROLES.GOALKEEPER);
          }

          // Si hay comodines disponibles, usar uno como arquero para el otro equipo
          if (availableWildcards.length > 0) {
            const wildcardForGK = availableWildcards.shift(); // Tomar el primer comodín
            if (wildcardForGK) {
              // Asignar al equipo que no tiene arquero
              const teamAHasGK = teamA.some(
                (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
              );
              if (teamAHasGK) {
                if (
                  addPlayerToTeam(wildcardForGK, teamB, PLAYER_ROLES.GOALKEEPER)
                ) {
                  console.log(`✅ Comodín asignado como arquero al equipo B`);
                }
              } else {
                if (
                  addPlayerToTeam(wildcardForGK, teamA, PLAYER_ROLES.GOALKEEPER)
                ) {
                  console.log(`✅ Comodín asignado como arquero al equipo A`);
                }
              }
            }
          }
        } else if (goalkeepers.length === 0 && availableWildcards.length >= 2) {
          // No hay arqueros específicos, pero hay al menos 2 comodines
          const sortedWildcards = [...availableWildcards].sort(
            () => Math.random() - 0.5
          );

          // Asignar los primeros 2 comodines como arqueros
          addPlayerToTeam(sortedWildcards[0], teamA, PLAYER_ROLES.GOALKEEPER);
          addPlayerToTeam(sortedWildcards[1], teamB, PLAYER_ROLES.GOALKEEPER);

          console.log(
            `✅ Asignados 2 comodines como arqueros (uno por equipo)`
          );

          // Remover los comodines asignados como arqueros de la lista
          availableWildcards.splice(0, 2);
        } else if (
          goalkeepers.length === 0 &&
          availableWildcards.length === 1
        ) {
          // No hay arqueros específicos, solo 1 comodín
          const wildcardForGK = availableWildcards.shift();
          if (wildcardForGK) {
            // Asignar aleatoriamente a un equipo
            if (Math.random() > 0.5) {
              if (
                addPlayerToTeam(wildcardForGK, teamA, PLAYER_ROLES.GOALKEEPER)
              ) {
                console.log(
                  `✅ Único comodín asignado como arquero al equipo A`
                );
              }
            } else {
              if (
                addPlayerToTeam(wildcardForGK, teamB, PLAYER_ROLES.GOALKEEPER)
              ) {
                console.log(
                  `✅ Único comodín asignado como arquero al equipo B`
                );
              }
            }
          }
        }

        // Distribuir defensores
        const defenders = playersByRole[PLAYER_ROLES.DEFENDER] || [];
        const sortedDefenders = [...defenders].sort(() => Math.random() - 0.5);

        // Distribuir defensores de manera equilibrada entre equipos
        sortedDefenders.forEach((defender, index) => {
          if (index % 2 === 0) {
            addPlayerToTeam(defender, teamA, PLAYER_ROLES.DEFENDER);
          } else {
            addPlayerToTeam(defender, teamB, PLAYER_ROLES.DEFENDER);
          }
        });

        // Distribuir mediocampistas
        const midfielders = playersByRole[PLAYER_ROLES.MIDFIELDER] || [];
        const sortedMidfielders = [...midfielders].sort(
          () => Math.random() - 0.5
        );

        // Distribuir mediocampistas de manera equilibrada entre equipos
        sortedMidfielders.forEach((midfielder, index) => {
          if (index % 2 === 0) {
            addPlayerToTeam(midfielder, teamA, PLAYER_ROLES.MIDFIELDER);
          } else {
            addPlayerToTeam(midfielder, teamB, PLAYER_ROLES.MIDFIELDER);
          }
        });

        // Distribuir delanteros
        const forwards = playersByRole[PLAYER_ROLES.FORWARD] || [];
        const sortedForwards = [...forwards].sort(() => Math.random() - 0.5);

        // Distribuir delanteros de manera equilibrada entre equipos
        sortedForwards.forEach((forward, index) => {
          if (index % 2 === 0) {
            addPlayerToTeam(forward, teamA, PLAYER_ROLES.FORWARD);
          } else {
            addPlayerToTeam(forward, teamB, PLAYER_ROLES.FORWARD);
          }
        });

        // Distribuir comodines y jugadores sobrantes
        // Combinar comodines restantes con jugadores sin rol
        const remainingPlayers = [...playersWithoutRole, ...availableWildcards];
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
          const result = [...team]; // Crear copia para no modificar el original

          // Asignar jugadores restantes usando el sistema flexible
          while (remainingPool.length > 0) {
            const player = remainingPool.shift();
            if (!player) break;

            // Usar el sistema flexible para asignar rol, priorizando defensor > mediocampo > delantero
            const availableRoles = [
              PLAYER_ROLES.DEFENDER,
              PLAYER_ROLES.MIDFIELDER,
              PLAYER_ROLES.FORWARD,
            ];
            const assignedRole = assignFlexibleRole(result, availableRoles);

            // Verificar que el jugador no esté ya en ningún equipo antes de añadirlo
            if (
              !isPlayerInTeam(player.id, teamA) &&
              !isPlayerInTeam(player.id, teamB)
            ) {
              result.push({ ...player, assignedRole });
            }
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

        // Aplicar balance final de posiciones a ambos equipos
        teamA = balanceTeamPositions(teamA);
        teamB = balanceTeamPositions(teamB);

        // Verificación final: eliminar duplicados si los hay
        const removeDuplicates = (team: Member[]): Member[] => {
          const seen = new Set<string>();
          return team.filter((player) => {
            if (seen.has(player.id)) {
              console.log(
                `⚠️ Jugador duplicado eliminado: ${player.name} (${player.id})`
              );
              return false;
            }
            seen.add(player.id);
            return true;
          });
        };

        teamA = removeDuplicates(teamA);
        teamB = removeDuplicates(teamB);

        // Verificar que no hay jugadores en ambos equipos
        const teamAIds = new Set(teamA.map((p) => p.id));
        const teamBIds = new Set(teamB.map((p) => p.id));
        const intersection = [...teamAIds].filter((id) => teamBIds.has(id));

        if (intersection.length > 0) {
          console.log(
            `🚨 Jugadores encontrados en ambos equipos: ${intersection.join(
              ', '
            )}`
          );
          // Remover duplicados del equipo B (mantener en equipo A)
          teamB = teamB.filter((player) => !teamAIds.has(player.id));
        }

        console.log(
          `✅ Verificación final: Equipo A (${teamA.length}), Equipo B (${
            teamB.length
          }), Total: ${teamA.length + teamB.length}`
        );

        return [teamA, teamB];
      };

      // Crear equipos aleatorios si no se requiere balanceo por edad o rol
      const createRandomTeams = (members: Member[]): [Member[], Member[]] => {
        // Safety check for empty input
        if (!members || members.length === 0) {
          console.log(
            'Warning: No members provided to createRandomTeams, returning empty teams'
          );
          return [[], []];
        }

        // Filter out any undefined or null members before proceeding
        const validMembers = members.filter((member) => member && member.id);

        // Safety check for no valid members
        if (validMembers.length === 0) {
          console.log(
            'Warning: No valid members found in createRandomTeams, returning empty teams'
          );
          return [[], []];
        }

        // Log the number of players before processing
        console.log(
          `Creating random teams with ${validMembers.length} players`
        );

        // Implementación mejorada del algoritmo Fisher-Yates para mezcla más robusta
        const shuffleArray = (array: Member[]): Member[] => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            // Usar una semilla aleatoria diferente en cada iteración
            const seedModifier = Math.sin(i * Date.now() * Math.random());
            const j = Math.floor((Math.random() + seedModifier) % (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        // Realizar varias pasadas de mezcla con diferentes técnicas
        let shuffledMembers = [...validMembers];

        // Primera pasada: Orden aleatorio básico
        shuffledMembers = shuffleArray(shuffledMembers);

        // Segunda pasada: Mezclar los jugadores reales una vez más
        // (asegura que jugadores con atributos similares puedan cambiar de equipo)
        shuffledMembers = shuffleArray(shuffledMembers);

        // Tercera pasada: Invertir el orden en segmentos aleatorios
        const randomSegment = Math.floor(
          Math.random() * shuffledMembers.length
        );
        const segmentToReverse = shuffledMembers.slice(0, randomSegment);
        segmentToReverse.reverse();
        shuffledMembers = [
          ...segmentToReverse,
          ...shuffledMembers.slice(randomSegment),
        ];

        // Dividir en dos equipos
        const halfIndex = Math.ceil(shuffledMembers.length / 2);
        let teamA = shuffledMembers.slice(0, halfIndex);
        let teamB = shuffledMembers.slice(halfIndex);

        // Ensure both teams contain only valid elements
        teamA = teamA.filter((p) => p && p.id);
        teamB = teamB.filter((p) => p && p.id);

        // Log the number of players in each team after division
        console.log(
          `Random teams created - Team A: ${teamA.length}, Team B: ${
            teamB.length
          }, Total: ${teamA.length + teamB.length} (Original: ${
            validMembers.length
          })`
        );

        // Verify all players are included
        const teamAIds = teamA.map((p) => p.id);
        const teamBIds = teamB.map((p) => p.id);
        const allAssignedIds = [...teamAIds, ...teamBIds];
        const allOriginalIds = validMembers.map((p) => p.id);

        // Check if any player is missing
        const missingIds = allOriginalIds.filter(
          (id) => !allAssignedIds.includes(id)
        );
        if (missingIds.length > 0) {
          console.log(
            `WARNING: ${missingIds.length} players were lost during random team creation`
          );

          // Find these missing players
          const missingPlayers = validMembers.filter((m) =>
            missingIds.includes(m.id)
          );

          // Add them back to teams
          missingPlayers.forEach((player, index) => {
            if (index % 2 === 0 || teamA.length < teamB.length) {
              teamA.push(player);
            } else {
              teamB.push(player);
            }
          });

          console.log(`Recovered ${missingPlayers.length} missing players`);
        }

        // Final safety check to ensure no undefined values
        return [teamA.filter((p) => p), teamB.filter((p) => p)];
      };

      // Determinar el método de creación de equipos según los parámetros
      let autoTeamA: Member[] = [];
      let autoTeamB: Member[] = [];

      // Realizar hasta 5 intentos para asegurar que los equipos cambien en un resorteo
      let maxAttempts = 5;
      let teamsChanged = !isResort; // Si no es resorteo, no necesitamos verificar cambios

      // Estos valores ya están establecidos desde la desestructuración del req.body
      // No es necesario redefinirlos aquí

      while (!teamsChanged && maxAttempts > 0) {
        // Elegir el método de balanceo según las opciones seleccionadas
        if (useRandomAlgorithm) {
          // Usar algoritmo completamente aleatorio si se ha solicitado explícitamente
          console.log(
            'Usando algoritmo completamente aleatorio (sin criterios de balance)'
          );
          [autoTeamA, autoTeamB] = createRandomTeams(mappedMembers);
        } else if (balanceByRating && balanceByRole && balanceByAge) {
          // Usar el nuevo algoritmo multicriteria para los tres criterios
          console.log('Usando el nuevo algoritmo de balanceo multicriteria');
          [autoTeamA, autoTeamB] =
            createBalancedTeamsByMultiCriteria(mappedMembers);
        } else if (balanceByRating && balanceByRole) {
          // Combinar balanceo por rating y rol (usando el combinado pero ignorando edad)
          [autoTeamA, autoTeamB] = createCombinedBalancedTeams(mappedMembers);
        } else if (balanceByRating && balanceByAge) {
          // Balanceo por rating y edad (podríamos también usar el combinado aquí)
          [autoTeamA, autoTeamB] = createCombinedBalancedTeams(mappedMembers);
        } else if (balanceByRole && balanceByAge) {
          // Usar TeamBuilder con formaciones mínimas garantizadas (4-3-3 o 4-4-2)
          console.log(
            '🎯 Usando TeamBuilder con formaciones mínimas garantizadas...'
          );
          const teamBuilder = new TeamBuilder(mappedMembers as any);
          const [teamA, teamB] = teamBuilder.buildTeams();
          autoTeamA = teamA as Member[];
          autoTeamB = teamB as Member[];
        } else if (balanceByRating) {
          // Solo balanceo por rating
          [autoTeamA, autoTeamB] = createRatingBalancedTeams(mappedMembers);
        } else if (balanceByRole) {
          // Usar TeamBuilder con formaciones mínimas garantizadas (4-3-3 o 4-4-2)
          console.log(
            '🎯 Usando TeamBuilder con formaciones mínimas garantizadas...'
          );
          const teamBuilder = new TeamBuilder(mappedMembers as any);
          const [teamA, teamB] = teamBuilder.buildTeams();
          autoTeamA = teamA as Member[];
          autoTeamB = teamB as Member[];
        } else if (balanceByAge) {
          // Solo balanceo por edad
          [autoTeamA, autoTeamB] = createBalancedTeams(mappedMembers);
        } else {
          // Equipos aleatorios sin balanceo
          [autoTeamA, autoTeamB] = createRandomTeams(mappedMembers);
        }

        // Garantizar que siempre haya un balance equitativo de jugadores reales
        // independientemente del algoritmo seleccionado
        [autoTeamA, autoTeamB] = ensureEvenRealPlayerDistribution(
          autoTeamA.filter((p) => p),
          autoTeamB.filter((p) => p)
        );

        // Verificar si los equipos han cambiado (solo para resorteo)
        if (isResort) {
          const newTeamAIds = autoTeamA.filter((p) => p).map((p) => p.id);
          const newTeamBIds = autoTeamB.filter((p) => p).map((p) => p.id);

          // Asegurar que los jugadores reales están balanceados correctamente
          // Identificar jugadores reales en cada equipo
          const realPlayersA = autoTeamA.filter(
            (p) => p && p.id && !p.id.toString().startsWith('tbd-')
          );
          const realPlayersB = autoTeamB.filter(
            (p) => p && p.id && !p.id.toString().startsWith('tbd-')
          );

          // Si el desbalance es mayor a 1, corregirlo
          const realPlayerDiff = Math.abs(
            realPlayersA.length - realPlayersB.length
          );
          if (realPlayerDiff > 1) {
            console.log(
              `Corrigiendo desbalance de jugadores reales final: A=${realPlayersA.length}, B=${realPlayersB.length}`
            );

            // Determinar equipo con más jugadores
            if (realPlayersA.length > realPlayersB.length) {
              // Mover (realPlayerDiff / 2) jugadores reales de A a B
              const playersToMove = Math.floor(realPlayerDiff / 2);
              for (let i = 0; i < playersToMove; i++) {
                const randomIdx = Math.floor(
                  Math.random() * realPlayersA.length
                );
                const playerToMove = realPlayersA[randomIdx];

                // Eliminar de A
                const idxInA = autoTeamA.findIndex(
                  (p) => p.id === playerToMove.id
                );
                if (idxInA !== -1) {
                  autoTeamA.splice(idxInA, 1);
                  autoTeamB.push(playerToMove);
                }
              }
            } else {
              // Mover (realPlayerDiff / 2) jugadores reales de B a A
              const playersToMove = Math.floor(realPlayerDiff / 2);
              for (let i = 0; i < playersToMove; i++) {
                const randomIdx = Math.floor(
                  Math.random() * realPlayersB.length
                );
                const playerToMove = realPlayersB[randomIdx];

                // Eliminar de B
                const idxInB = autoTeamB.findIndex(
                  (p) => p.id === playerToMove.id
                );
                if (idxInB !== -1) {
                  autoTeamB.splice(idxInB, 1);
                  autoTeamA.push(playerToMove);
                }
              }
            }

            console.log(
              `Balance final: A=${
                autoTeamA.filter(
                  (p) => p && p.id && !p.id.toString().startsWith('tbd-')
                ).length
              }, B=${
                autoTeamB.filter(
                  (p) => p && p.id && !p.id.toString().startsWith('tbd-')
                ).length
              }`
            );
          }

          // Calcular cuántos jugadores cambiaron de equipo
          let teamChanges = 0;

          if (previousTeams) {
            // Jugadores que cambiaron de equipo A a B
            const changesAtoB = previousTeams.teamA.filter(
              (player: { id: string }) => newTeamBIds.includes(player.id)
            ).length;

            // Jugadores que cambiaron de equipo B a A
            const changesBtoA = previousTeams.teamB.filter(
              (player: { id: string }) => newTeamAIds.includes(player.id)
            ).length;

            teamChanges = changesAtoB + changesBtoA;

            console.log(
              `Jugadores que cambiaron de equipo: ${teamChanges} (${changesAtoB} de A→B, ${changesBtoA} de B→A)`
            );
          }

          // Requerir más cambios: al menos 25% de jugadores deben cambiar de equipo
          // con un mínimo de 2 jugadores cambiados
          const minChangeRequired = Math.max(
            2,
            Math.floor(mappedMembers.length * 0.25)
          );
          teamsChanged = teamChanges >= minChangeRequired;

          console.log(`Intento ${6 - maxAttempts} de resorteo:`, {
            jugadoresQueHanCambiado: teamChanges,
            minimoNecesario: minChangeRequired,
            cambiosSuficientes: teamsChanged,
            jugadoresEnEquipoA: autoTeamA.length,
            jugadoresEnEquipoB: autoTeamB.length,
          });

          // Si los cambios no son suficientes, forzar más cambios
          if (!teamsChanged) {
            // Forzar la inversión de un segmento aleatorio
            const combinedPlayers = [...autoTeamA, ...autoTeamB];
            const randomStart = Math.floor(
              Math.random() * (combinedPlayers.length / 2)
            );
            const randomEnd =
              randomStart +
              Math.floor(Math.random() * (combinedPlayers.length / 2)) +
              2;
            const segment = combinedPlayers.slice(randomStart, randomEnd);
            segment.reverse();
            const reshuffledPlayers = [
              ...combinedPlayers.slice(0, randomStart),
              ...segment,
              ...combinedPlayers.slice(randomEnd),
            ];

            // Re-dividir en equipos
            const halfIndex = Math.ceil(reshuffledPlayers.length / 2);
            autoTeamA = reshuffledPlayers.slice(0, halfIndex);
            autoTeamB = reshuffledPlayers.slice(halfIndex);

            // Considerar el cambio suficiente después de forzar
            teamsChanged = true;
            console.log(
              'Forzando cambios adicionales para garantizar equipos diferentes'
            );
          }
        } else {
          teamsChanged = true; // No es un resorteo, no verificamos cambios
        }

        maxAttempts--;
      }

      // Calcular edad promedio por equipo
      const calculateAverageAge = (team: Member[]): number => {
        const membersWithAge = team.filter(
          (m) => m.age !== null && m.age !== undefined
        );
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
      finalTeamA = autoTeamA.map((player) => {
        // Buscar datos de usuario para obtener la imagen/avatar
        const userData = allUsersData.find(
          (u: { id: string }) => u.id === player.id
        );

        // Asegurarnos de que la edad se incluya correctamente
        return {
          id: player.id,
          name: player.name,
          avatar: userData?.image, // Usar imagen del usuario si existe
          playerType: 'TEAM',
          age:
            player.age !== null && player.age !== undefined ? player.age : null,
          playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD], // Mantener los roles originales del jugador
          assignedRole: player.assignedRole || PLAYER_ROLES.WILDCARD, // Rol asignado para la formación
          starRating: player.starRating !== undefined ? player.starRating : 3, // Incluir el star rating
        };
      });

      finalTeamB = autoTeamB.map((player) => {
        // Buscar datos de usuario para obtener la imagen/avatar
        const userData = allUsersData.find(
          (u: { id: string }) => u.id === player.id
        );

        // Asegurarnos de que la edad se incluya correctamente
        return {
          id: player.id,
          name: player.name,
          avatar: userData?.image, // Usar imagen del usuario si existe
          playerType: 'TEAM',
          age:
            player.age !== null && player.age !== undefined ? player.age : null,
          playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD], // Mantener los roles originales del jugador
          assignedRole: player.assignedRole || PLAYER_ROLES.WILDCARD, // Rol asignado para la formación
          starRating: player.starRating !== undefined ? player.starRating : 3, // Incluir el star rating
        };
      });

      // Asegurar que todos los jugadores tengan una edad definida y calcular promedios
      teamAAvgAge = calculateAverageAge(autoTeamA);
      teamBAvgAge = calculateAverageAge(autoTeamB);

      console.log('Equipos formados:', {
        teamAAvgAge,
        teamBAvgAge,
        totalPlayers: finalTeamA.length + finalTeamB.length,
        originalPlayers: mappedMembers.length,
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

      // Verificar si se perdieron jugadores durante el proceso
      const allAssignedPlayerIds = [...finalTeamA, ...finalTeamB].map(
        (p) => p.id
      );
      const originalPlayerIds = mappedMembers.map((p) => p.id);
      const missingPlayerIds = originalPlayerIds.filter(
        (id) => !allAssignedPlayerIds.includes(id)
      );

      if (missingPlayerIds.length > 0) {
        console.log(
          `🚨 JUGADORES PERDIDOS DURANTE EL PROCESO: ${missingPlayerIds.length}`
        );
        console.log('IDs perdidos:', missingPlayerIds);

        // Encontrar los jugadores perdidos y agregarlos al equipo más pequeño
        const missingPlayers = mappedMembers.filter((p) =>
          missingPlayerIds.includes(p.id)
        );
        console.log(
          'Jugadores perdidos:',
          missingPlayers.map((p) => ({ id: p.id, name: p.name }))
        );

        // Agregar jugadores perdidos al equipo más pequeño con formato correcto
        missingPlayers.forEach((player) => {
          // Buscar datos de usuario para obtener la imagen/avatar
          const userData = allUsersData.find(
            (u: { id: string }) => u.id === player.id
          );

          // Determinar el rol asignado usando la función assignFlexibleRole
          const targetTeam =
            finalTeamA.length <= finalTeamB.length ? finalTeamA : finalTeamB;
          const availableRoles = [
            PLAYER_ROLES.DEFENDER,
            PLAYER_ROLES.MIDFIELDER,
            PLAYER_ROLES.FORWARD,
          ];

          // Si el jugador ya tiene un rol asignado, usarlo; si no, asignar uno flexible
          let assignedRole = player.assignedRole;
          if (!assignedRole) {
            // Obtener el rol principal del jugador si tiene roles definidos
            const primaryRole = getPrimaryRole(player.playerRoles);
            if (primaryRole && primaryRole !== PLAYER_ROLES.WILDCARD) {
              assignedRole = primaryRole;
            } else {
              // Usar la función flexible para asignar rol
              assignedRole = assignFlexibleRole(targetTeam, availableRoles);
            }
          }

          const formattedPlayer = {
            id: player.id,
            name: player.name,
            avatar: userData?.image,
            playerType: 'TEAM',
            age:
              player.age !== null && player.age !== undefined
                ? player.age
                : null,
            playerRoles: player.playerRoles || [PLAYER_ROLES.WILDCARD],
            assignedRole: assignedRole,
            starRating: player.starRating !== undefined ? player.starRating : 3,
          };

          if (finalTeamA.length <= finalTeamB.length) {
            finalTeamA.push(formattedPlayer);
            console.log(
              `✅ Jugador recuperado agregado al equipo A: ${player.name} (${assignedRole})`
            );
          } else {
            finalTeamB.push(formattedPlayer);
            console.log(
              `✅ Jugador recuperado agregado al equipo B: ${player.name} (${assignedRole})`
            );
          }
        });

        console.log(
          `✅ Recuperados ${missingPlayers.length} jugadores perdidos`
        );
        console.log(
          `Nuevos totales: Equipo A (${finalTeamA.length}), Equipo B (${finalTeamB.length})`
        );
      }
    }

    // Añadir jugadores TBD si es necesario
    const addTbdPlayers = (team: any[], isTeamA: boolean) => {
      console.log(
        `🔧 addTbdPlayers llamado para equipo ${isTeamA ? 'A' : 'B'}:`,
        {
          teamLength: team.length,
          allowTbdPlayers,
          allowTbdPlayersParam,
          requiredPlayersPerTeam,
          groupRequiredPlayers: group.requiredPlayers,
          isResort,
          sortCount: existingMatch?.sortCount,
        }
      );

      // Si no se permite añadir TBD players, retornar array vacío
      if (allowTbdPlayers === false) {
        console.log(
          `🚫 TBD players deshabilitados para equipo ${
            isTeamA ? 'A' : 'B'
          } - allowTbdPlayers=${allowTbdPlayers}`
        );
        return [];
      }

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
          console.log(
            `✅ Usando TBD players predefinidos para equipo ${
              isTeamA ? 'A' : 'B'
            }: ${tbdForTeam.length}`
          );
          return tbdForTeam;
        }
      }

      // CORRECCIÓN CRÍTICA: Verificar si hay suficientes jugadores TOTALES antes de agregar TBD
      // Si hay 22 jugadores confirmados, NO deben agregarse TBD players
      const totalConfirmedPlayers = finalTeamA.length + finalTeamB.length;

      console.log(
        `🔍 Verificación TBD: Total confirmados=${totalConfirmedPlayers}, Requeridos=${group.requiredPlayers}`
      );

      if (totalConfirmedPlayers >= group.requiredPlayers) {
        console.log(
          `✅ Hay suficientes jugadores confirmados (${totalConfirmedPlayers}/${group.requiredPlayers}) - NO se agregan TBD`
        );
        return []; // No agregar TBD si ya hay suficientes jugadores confirmados
      }

      // SOLO agregar TBD si realmente faltan jugadores globalmente
      if (team.length >= requiredPlayersPerTeam) {
        console.log(
          `✅ Equipo ${isTeamA ? 'A' : 'B'} ya tiene suficientes jugadores (${
            team.length
          }/${requiredPlayersPerTeam})`
        );
        return []; // No need for TBD players on this team
      }

      // Calcular cuántos TBD players se necesitan para este equipo específico
      const tbdCount = requiredPlayersPerTeam - team.length;

      console.log(
        `🔧 Generando ${tbdCount} jugadores TBD para equipo ${
          isTeamA ? 'A' : 'B'
        } (tiene ${team.length}/${requiredPlayersPerTeam})`
      );

      // Crear jugadores TBD genéricos
      const generatedTbdPlayers: TbdPlayer[] = [];

      // Añadir jugadores TBD hasta completar el número requerido
      while (
        team.length + generatedTbdPlayers.length <
        requiredPlayersPerTeam
      ) {
        const tbdIndex = generatedTbdPlayers.length;
        const teamLetter = isTeamA ? 'A' : 'B';
        generatedTbdPlayers.push({
          id: `tbd-${Date.now()}-${tbdIndex}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,
          name: `Fantasma ${teamLetter}${tbdIndex + 1}`,
          isTeamA,
          avatar: null,
          playerType: 'TBD',
        });
      }

      console.log(
        `✅ Generados ${generatedTbdPlayers.length} jugadores TBD para equipo ${
          isTeamA ? 'A' : 'B'
        }`
      );
      return generatedTbdPlayers;
    };

    // Mover la llamada a addTbdPlayers después de la verificación final

    let match: any;

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

    // Mover la creación de matchPlayers después de la actualización del match

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
          role:
            p.assignedRole ||
            getPrimaryRole(p.playerRoles) ||
            'No especificado',
        })),
        teamB: finalTeamB.map((p: any) => ({
          id: p.userId || p.id,
          name: p.name,
          role:
            p.assignedRole ||
            getPrimaryRole(p.playerRoles) ||
            'No especificado',
        })),
      },
      balancingCriteria: {
        byAge: balanceByAge === true,
        byRole: req.body.balanceByRole !== false,
        byRating: req.body.balanceByRating === true,
      },
    };

    // Solo incluir equipos anteriores si es un resort y sortCount > 0
    if (isResort && previousTeams) {
      logData.previousTeams = {
        teamA: previousTeams.teamA.map((p: any) => ({
          id: p.userId || p.id,
          name: p.name,
          role: p.role,
        })),
        teamB: previousTeams.teamB.map((p: any) => ({
          id: p.userId || p.id,
          name: p.name,
          role: p.role,
        })),
      };
    }

    // Registrar en logs
    await logGroupEvent(groupId, user.id, logAction, logData);

    // Verificar una última vez que los roles de goalkeepers estén correctamente asignados
    const verifyFinalTeams = (teamA: any[], teamB: any[]) => {
      // Contar arqueros en cada equipo
      const gkA = teamA.filter(
        (p) => p && p.assignedRole === PLAYER_ROLES.GOALKEEPER
      ).length;
      const gkB = teamB.filter(
        (p) => p && p.assignedRole === PLAYER_ROLES.GOALKEEPER
      ).length;

      console.log(
        `📊 Verificación final - Arqueros: Equipo A (${gkA}), Equipo B (${gkB})`
      );

      // Si hay un desbalance importante, corregirlo
      if (gkA >= 2 && gkB === 0 && teamA.length > 0 && teamB.length > 0) {
        console.log('🚨 Corrigiendo desbalance final de arqueros (A→B)');
        // Buscar un arquero en el equipo A
        const gkIndex = teamA.findIndex(
          (p) => p && p.assignedRole === PLAYER_ROLES.GOALKEEPER
        );
        if (gkIndex !== -1) {
          const gk = teamA[gkIndex];
          // Moverlo al equipo B
          teamA.splice(gkIndex, 1);
          teamB.push(gk);
        }
      } else if (
        gkB >= 2 &&
        gkA === 0 &&
        teamB.length > 0 &&
        teamA.length > 0
      ) {
        console.log('🚨 Corrigiendo desbalance final de arqueros (B→A)');
        // Buscar un arquero en el equipo B
        const gkIndex = teamB.findIndex(
          (p) => p && p.assignedRole === PLAYER_ROLES.GOALKEEPER
        );
        if (gkIndex !== -1) {
          const gk = teamB[gkIndex];
          // Moverlo al equipo A
          teamB.splice(gkIndex, 1);
          teamA.push(gk);
        }
      }

      return [teamA, teamB];
    };

    // En el código final antes de la respuesta:
    [finalTeamA, finalTeamB] = verifyFinalTeams(finalTeamA, finalTeamB);

    // Verificación final de duplicados antes de retornar
    const finalRemoveDuplicates = (team: any[]): any[] => {
      const seen = new Set<string>();
      return team.filter((player) => {
        if (!player || !player.id) return false;
        if (seen.has(player.id)) {
          console.log(
            `⚠️ Jugador duplicado eliminado en verificación final: ${player.name} (${player.id})`
          );
          return false;
        }
        seen.add(player.id);
        return true;
      });
    };

    finalTeamA = finalRemoveDuplicates(finalTeamA);
    finalTeamB = finalRemoveDuplicates(finalTeamB);

    // Verificar que no hay jugadores en ambos equipos finales
    const finalTeamAIds = new Set(finalTeamA.map((p) => p.id));
    const finalTeamBIds = new Set(finalTeamB.map((p) => p.id));
    const finalIntersection = [...finalTeamAIds].filter((id) =>
      finalTeamBIds.has(id)
    );

    if (finalIntersection.length > 0) {
      console.log(
        `🚨 Jugadores encontrados en ambos equipos finales: ${finalIntersection.join(
          ', '
        )}`
      );
      // Remover duplicados del equipo B (mantener en equipo A)
      finalTeamB = finalTeamB.filter((player) => !finalTeamAIds.has(player.id));
    }

    console.log(
      `✅ Verificación final completa: Equipo A (${
        finalTeamA.length
      }), Equipo B (${finalTeamB.length}), Total: ${
        finalTeamA.length + finalTeamB.length
      }`
    );

    // Ahora sí, agregar TBD players si es necesario (después de todas las verificaciones)
    const tbdPlayersTeamA = addTbdPlayers(finalTeamA, true);
    const tbdPlayersTeamB = addTbdPlayers(finalTeamB, false);

    // DEBUGGING: Log detallado del proceso de generación de TBD players
    console.log('🔍 DEBUGGING TBD PLAYERS GENERATION:', {
      allowTbdPlayers,
      allowTbdPlayersParam,
      finalTeamALength: finalTeamA.length,
      finalTeamBLength: finalTeamB.length,
      requiredPlayersPerTeam,
      tbdPlayersTeamALength: tbdPlayersTeamA.length,
      tbdPlayersTeamBLength: tbdPlayersTeamB.length,
    });

    // DEBUGGING: Si no se generaron TBD players pero deberían haberse generado
    if (
      allowTbdPlayers &&
      (finalTeamA.length < requiredPlayersPerTeam ||
        finalTeamB.length < requiredPlayersPerTeam)
    ) {
      console.log(
        '🚨 WARNING: No se generaron TBD players cuando deberían haberse generado!'
      );
      console.log('🔍 Detalles:', {
        'Equipo A necesita': requiredPlayersPerTeam - finalTeamA.length,
        'Equipo B necesita': requiredPlayersPerTeam - finalTeamB.length,
        'TBD generados equipo A': tbdPlayersTeamA.length,
        'TBD generados equipo B': tbdPlayersTeamB.length,
      });
    }

    // Preparar los datos para la respuesta (ahora que tenemos tbdPlayersTeamA y tbdPlayersTeamB)
    const tbdPlayers = {
      teamA: tbdPlayersTeamA,
      teamB: tbdPlayersTeamB,
      playerRoles: playerRolesMap, // Todos los roles elegidos
      assignedRoles: assignedRolesMap, // Roles asignados para la formación
    };

    // Ahora crear/actualizar el match con los datos completos
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

    // AHORA crear los matchPlayers después de tener el match actualizado
    // Registrar jugadores del equipo A
    for (const player of finalTeamA) {
      // Skip invalid player IDs or TBD players which have special ID formats
      if (!player.id || player.id.toString().startsWith('tbd-')) {
        continue;
      }

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

    // Registrar jugadores del equipo B
    for (const player of finalTeamB) {
      // Skip invalid player IDs or TBD players which have special ID formats
      if (!player.id || player.id.toString().startsWith('tbd-')) {
        continue;
      }

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

    // Ordenar los equipos por posición antes de retornarlos
    const sortedTeamA = sortPlayersByRole(finalTeamA);
    const sortedTeamB = sortPlayersByRole(finalTeamB);

    // Retornar los equipos formados y el partido creado
    return res.status(200).json({
      message: isResort
        ? 'Equipos reorganizados correctamente'
        : 'Partido creado correctamente',
      teamA: sortedTeamA,
      teamB: sortedTeamB,
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
