import { Member } from './types';
import { PLAYER_ROLES, MAX_GOALKEEPERS_PER_TEAM } from './constants';
import { PlayerRole } from '../teambuilder';

// Función para asignar roles de manera flexible (de atrás hacia adelante)
export const assignFlexibleRole = (
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

        // Si asignar este rol no va a crear un desbalance de más de 1
        if (currentCount <= maxOtherCount) {
          return role;
        }
      }
    }

    // Si no se puede asignar ningún rol sin crear desbalance, usar el menos numeroso
    return minRole;
  }

  // Si no hay roles no-GK disponibles, usar WILDCARD
  return PLAYER_ROLES.WILDCARD;
};

export const getPrimaryRole = (
  playerRoles?: PlayerRole[] | string[]
): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) {
    return PLAYER_ROLES.WILDCARD; // Usar comodín como default
  }

  // Si es un array de strings, devolver el primero
  if (typeof playerRoles[0] === 'string') {
    return playerRoles[0] as string;
  }

  // Si es un array de PlayerRole, devolver el de mayor prioridad
  const roleObjects = playerRoles as PlayerRole[];
  const sortedRoles = roleObjects.sort((a, b) => a.priority - b.priority);
  return sortedRoles[0]?.role;
};

export const playerHasRole = (player: Member, targetRole: string): boolean => {
  if (!player.playerRoles) return false;

  // Si playerRoles es un array de strings
  if (typeof player.playerRoles[0] === 'string') {
    return (player.playerRoles as unknown as string[]).includes(targetRole);
  }

  // Si playerRoles es un array de PlayerRole
  const roleObjects = player.playerRoles as PlayerRole[];
  return roleObjects.some((role) => role.role === targetRole);
};

export const getAvailablePlayersByRole = (players: Member[]) => {
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
    if (!player.playerRoles || player.playerRoles.length === 0) {
      // Jugadores sin roles específicos van a wildcard para todas las posiciones
      Object.keys(availableByRole).forEach((role) => {
        availableByRole[role].wildcard.push(player);
      });
      return;
    }

    // Si playerRoles es un array de strings
    if (typeof player.playerRoles[0] === 'string') {
      const roles = player.playerRoles as unknown as string[];
      if (roles.length === 1 && roles[0] === PLAYER_ROLES.WILDCARD) {
        // Jugador comodín va a wildcard para todas las posiciones
        Object.keys(availableByRole).forEach((role) => {
          availableByRole[role].wildcard.push(player);
        });
      } else {
        // Primer rol como primario, resto como secundario
        const primaryRole = roles[0];
        if (availableByRole[primaryRole]) {
          availableByRole[primaryRole].primary.push(player);
        }
        roles.slice(1).forEach((role) => {
          if (availableByRole[role]) {
            availableByRole[role].secondary.push(player);
          }
        });
      }
    } else {
      // Si playerRoles es un array de PlayerRole
      const roleObjects = player.playerRoles as PlayerRole[];
      const sortedRoles = roleObjects.sort((a, b) => a.priority - b.priority);

      if (
        sortedRoles.length === 1 &&
        sortedRoles[0].role === PLAYER_ROLES.WILDCARD
      ) {
        // Jugador comodín va a wildcard para todas las posiciones
        Object.keys(availableByRole).forEach((role) => {
          availableByRole[role].wildcard.push(player);
        });
      } else {
        // Primer rol como primario, resto como secundario
        const primaryRole = sortedRoles[0].role;
        if (availableByRole[primaryRole]) {
          availableByRole[primaryRole].primary.push(player);
        }
        sortedRoles.slice(1).forEach((roleObj) => {
          if (availableByRole[roleObj.role]) {
            availableByRole[roleObj.role].secondary.push(player);
          }
        });
      }
    }
  });

  return availableByRole;
};

export const sortPlayersByRole = (players: any[]) => {
  const sortOrder = [
    PLAYER_ROLES.GOALKEEPER,
    PLAYER_ROLES.DEFENDER,
    PLAYER_ROLES.MIDFIELDER,
    PLAYER_ROLES.FORWARD,
    PLAYER_ROLES.WILDCARD,
  ];

  return players.sort((a, b) => {
    const aRole = a.assignedRole || a.role || PLAYER_ROLES.WILDCARD;
    const bRole = b.assignedRole || b.role || PLAYER_ROLES.WILDCARD;

    const aIndex = sortOrder.indexOf(aRole);
    const bIndex = sortOrder.indexOf(bRole);

    // Si no se encuentra el rol, ponerlo al final
    const aOrder = aIndex === -1 ? sortOrder.length : aIndex;
    const bOrder = bIndex === -1 ? sortOrder.length : bIndex;

    return aOrder - bOrder;
  });
};
