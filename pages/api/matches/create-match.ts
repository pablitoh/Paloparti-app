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

// Función para balancear equipos por rol y edad simultáneamente
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

  // Para cada rol, ordenar por edad y distribuir alternadamente
  const distributeRoleByAge = (role: string, maxPerTeam: number) => {
    const players = playersByRole[role] || [];

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

    // Limitar cantidad según formación
    const count = Math.min(sortedByAge.length, maxPerTeam * 2);
    const forTeamA: Member[] = [];
    const forTeamB: Member[] = [];

    // Distribuir alternadamente para balancear edades
    sortedByAge.slice(0, count).forEach((player, index) => {
      if (index % 2 === 0) {
        forTeamA.push({ ...player, assignedRole: role });
      } else {
        forTeamB.push({ ...player, assignedRole: role });
      }
    });

    // Devolver jugadores sobrantes
    return {
      teamA: forTeamA,
      teamB: forTeamB,
      remaining: sortedByAge.slice(count),
    };
  };

  // Distribuir arqueros
  const gkResult = distributeRoleByAge(
    PLAYER_ROLES.GOALKEEPER,
    FORMATION.GOALKEEPER
  );
  teamA.push(...gkResult.teamA);
  teamB.push(...gkResult.teamB);
  playersWithoutRole.push(...gkResult.remaining);

  // Distribuir defensores
  const defResult = distributeRoleByAge(
    PLAYER_ROLES.DEFENDER,
    FORMATION.DEFENDERS
  );
  teamA.push(...defResult.teamA);
  teamB.push(...defResult.teamB);
  playersWithoutRole.push(...defResult.remaining);

  // Distribuir mediocampistas
  const midResult = distributeRoleByAge(
    PLAYER_ROLES.MIDFIELDER,
    FORMATION.MIDFIELDERS
  );
  teamA.push(...midResult.teamA);
  teamB.push(...midResult.teamB);
  playersWithoutRole.push(...midResult.remaining);

  // Distribuir delanteros
  const fwdResult = distributeRoleByAge(
    PLAYER_ROLES.FORWARD,
    FORMATION.FORWARDS
  );
  teamA.push(...fwdResult.teamA);
  teamB.push(...fwdResult.teamB);
  playersWithoutRole.push(...fwdResult.remaining);

  // Distribuir comodines y jugadores sobrantes por edad
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

  // Distribuir alternadamente para balancear edades
  sortedRemaining.forEach((player, index) => {
    if (index % 2 === 0) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
  });

  // NUEVO: Verificar y corregir balance final si hay una diferencia mayor a 1 jugador entre equipos
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
  console.log('Distribución de jugadores por rol y edad:');
  Object.values(PLAYER_ROLES).forEach((roleName) => {
    console.log(
      `${roleName}: ${playersByRole[roleName]?.length || 0} jugadores`
    );
  });
  console.log(`Sin rol asignado: ${playersWithoutRole.length} jugadores`);
  console.log(
    `Equipo A: ${teamA.length} jugadores, Equipo B: ${teamB.length} jugadores`
  );

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

  const teamA: Member[] = [];
  const teamB: Member[] = [];

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

  // Para cada rol, ordenar por combinación de edad y rating
  const distributeRoleByAgeAndRating = (role: string, maxPerTeam: number) => {
    const players = playersByRole[role] || [];

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

    // Para cada grupo de puntaje, mezclarlos y distribuirlos
    scores.forEach((score) => {
      // Mezclar jugadores con el mismo puntaje
      const shuffledSameScore = [...playersByScore[score.toFixed(1)]].sort(
        () => Math.random() - 0.5
      );

      // Distribuir alternadamente hasta alcanzar el máximo por equipo
      shuffledSameScore.forEach((player, index) => {
        if (forTeamA.length < maxPerTeam && forTeamB.length < maxPerTeam) {
          if (index % 2 === 0) {
            forTeamA.push({ ...player, assignedRole: role });
          } else {
            forTeamB.push({ ...player, assignedRole: role });
          }
        }
      });
    });

    // Determinar jugadores sobrantes
    const usedPlayers = [...forTeamA, ...forTeamB].map((p) => p.id);
    const remaining = players.filter((p) => !usedPlayers.includes(p.id));

    // Devolver jugadores a cada equipo y los sobrantes
    return {
      teamA: forTeamA,
      teamB: forTeamB,
      remaining,
    };
  };

  // Distribuir arqueros
  const gkResult = distributeRoleByAgeAndRating(
    PLAYER_ROLES.GOALKEEPER,
    FORMATION.GOALKEEPER
  );
  teamA.push(...gkResult.teamA);
  teamB.push(...gkResult.teamB);
  playersWithoutRole.push(...gkResult.remaining);

  // Distribuir defensores
  const defResult = distributeRoleByAgeAndRating(
    PLAYER_ROLES.DEFENDER,
    FORMATION.DEFENDERS
  );
  teamA.push(...defResult.teamA);
  teamB.push(...defResult.teamB);
  playersWithoutRole.push(...defResult.remaining);

  // Distribuir mediocampistas
  const midResult = distributeRoleByAgeAndRating(
    PLAYER_ROLES.MIDFIELDER,
    FORMATION.MIDFIELDERS
  );
  teamA.push(...midResult.teamA);
  teamB.push(...midResult.teamB);
  playersWithoutRole.push(...midResult.remaining);

  // Distribuir delanteros
  const fwdResult = distributeRoleByAgeAndRating(
    PLAYER_ROLES.FORWARD,
    FORMATION.FORWARDS
  );
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

  // Distribuir alternadamente para balancear
  sortedRemaining.forEach((player, index) => {
    if (index % 2 === 0) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
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
      member.playerRoles?.includes(PLAYER_ROLES.WILDCARD) || false;
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
  const teamA: Member[] = [];
  const teamB: Member[] = [];

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

    // Ordenar arqueros por habilidad
    goalkeepers.sort((a, b) => (b.starRating || 3) - (a.starRating || 3));

    // Distribuir un arquero a cada equipo primero (los mejores)
    if (goalkeepers.length >= 2) {
      teamA.push({ ...goalkeepers[0], assignedRole: PLAYER_ROLES.GOALKEEPER });
      teamB.push({ ...goalkeepers[1], assignedRole: PLAYER_ROLES.GOALKEEPER });

      // Reclasificar arqueros excedentes como comodines si hay más de 2
      for (let i = 2; i < goalkeepers.length; i++) {
        wildcards.push(goalkeepers[i]);
      }

      // Eliminamos los arqueros ya asignados
      playersByPosition[PLAYER_ROLES.GOALKEEPER] = [];
    }
    // Si solo hay un arquero, asignarlo al equipo que tenga menos nivel de habilidad
    else if (goalkeepers.length === 1) {
      const metricsA = calculateTeamMetrics(teamA);
      const metricsB = calculateTeamMetrics(teamB);

      if (metricsA.skillAvg <= metricsB.skillAvg) {
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

      playersByPosition[PLAYER_ROLES.GOALKEEPER] = [];
    }
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

    // Distribuir para equilibrar nivel de habilidad
    if (metricsA.skillAvg <= metricsB.skillAvg) {
      teamA.push({ ...topPlayers[0], assignedRole: position });
      teamB.push({ ...topPlayers[1], assignedRole: position });
    } else {
      teamB.push({ ...topPlayers[0], assignedRole: position });
      teamA.push({ ...topPlayers[1], assignedRole: position });
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
      const isBigAgeDiff = Math.abs(ageDiff) > 7; // Si hay más de 7 años de diferencia promedio

      // MEJORA 5: Evitar diferencias extremas de habilidad
      const hasSkillImbalance = Math.abs(skillDiff) > 0.8;

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

      // Asignar a la posición más necesitada
      if (gkCount < FORMATION.GOALKEEPER) return PLAYER_ROLES.GOALKEEPER;
      if (defCount < FORMATION.DEFENDERS) return PLAYER_ROLES.DEFENDER;
      if (midCount < FORMATION.MIDFIELDERS) return PLAYER_ROLES.MIDFIELDER;
      if (fwdCount < FORMATION.FORWARDS) return PLAYER_ROLES.FORWARD;

      // Si todas están cubiertas, asignar como comodín
      return PLAYER_ROLES.WILDCARD;
    };

    // Calcular puntajes de necesidad
    const skillDiff = metricsA.skillAvg - metricsB.skillAvg;
    const ageDiff = metricsA.ageAvg - metricsB.ageAvg;
    const teamSizeDiff = teamA.length - teamB.length;

    // Puntaje compuesto (mayor valor favorece al equipo B)
    const compositeScore = skillDiff * 0.5 + ageDiff * 0.3 + teamSizeDiff * 0.2;

    // Asignar al equipo más necesitado
    if (
      compositeScore > 0.1 ||
      (Math.abs(compositeScore) <= 0.1 && teamA.length > teamB.length)
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

    // 1. Verificar que cada equipo tenga al menos un arquero
    const gkCountA = metricsA.roleCounts[PLAYER_ROLES.GOALKEEPER] || 0;
    const gkCountB = metricsB.roleCounts[PLAYER_ROLES.GOALKEEPER] || 0;

    if (gkCountA > 1 && gkCountB === 0) {
      // Trasladar un arquero del equipo A al B
      for (let i = 0; i < teamA.length; i++) {
        if (teamA[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          const gk = teamA.splice(i, 1)[0];
          teamB.push(gk);
          break;
        }
      }
    } else if (gkCountB > 1 && gkCountA === 0) {
      // Trasladar un arquero del equipo B al A
      for (let i = 0; i < teamB.length; i++) {
        if (teamB[i].assignedRole === PLAYER_ROLES.GOALKEEPER) {
          const gk = teamB.splice(i, 1)[0];
          teamA.push(gk);
          break;
        }
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

  return [teamA, teamB];
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
      balanceByRole = true, // Por defecto true si no se especifica
      balanceByRating = false, // Por defecto false si no se especifica
      teamA = null,
      teamB = null,
      mode = 'auto', // 'auto' para sorteo automático, 'manual' para equipos manuales
      matchId = null, // ID del partido existente (para resort)
      isResort = false, // Indica si es un re-sorteo de un partido existente
      players = [], // Lista de jugadores proporcionada para el sorteo
      tbdPlayersInput = { teamA: [], teamB: [] }, // Jugadores TBD predefinidos
      allowTbdPlayers = true, // Por defecto permitir TBD players si no se especifica
      useRandomAlgorithm = false, // Parámetro para usar algoritmo completamente aleatorio
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
                // Obtener los roles del jugador si existen
                playerRoles: playerRoles[attendance.user.id] || [],
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

        const teamA: Member[] = [];
        const teamB: Member[] = [];

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
          // Balanceo por rol y edad
          [autoTeamA, autoTeamB] = createRoleAndAgeBalancedTeams(mappedMembers);
        } else if (balanceByRating) {
          // Solo balanceo por rating
          [autoTeamA, autoTeamB] = createRatingBalancedTeams(mappedMembers);
        } else if (balanceByRole) {
          // Solo balanceo por rol
          [autoTeamA, autoTeamB] = createRoleBalancedTeams(mappedMembers);
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
      // Si no se permite añadir TBD players, retornar array vacío
      if (allowTbdPlayers === false) {
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
          return tbdForTeam;
        }
      }

      // Check if we have enough players across BOTH teams before adding TBD players
      const totalRealPlayers = finalTeamA.length + finalTeamB.length;
      const totalRequiredPlayers = requiredPlayersPerTeam * 2;

      console.log(
        `Checking if TBD players are needed: ${totalRealPlayers} real players vs ${totalRequiredPlayers} required`
      );

      if (totalRealPlayers >= totalRequiredPlayers) {
        console.log('No TBD players needed, we have enough real players');
        return []; // No TBD players needed if we have enough real players across both teams
      }

      // If we're below the total required but this specific team has enough, still don't add TBD
      if (team.length >= requiredPlayersPerTeam) {
        console.log(
          `Team ${isTeamA ? 'A' : 'B'} has enough players (${
            team.length
          }), not adding TBD`
        );
        return []; // No need for TBD players on this team
      }

      // For teams with insufficient players, calculate how many TBD to add
      const tbdCount = requiredPlayersPerTeam - team.length;
      console.log(
        `Adding ${tbdCount} TBD players to Team ${isTeamA ? 'A' : 'B'}`
      );

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
