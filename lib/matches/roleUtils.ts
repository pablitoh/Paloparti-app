import { Member, PlayerRoleType, PlayerRole } from '../teambuilder/types';
import { PLAYER_ROLES, MAX_GOALKEEPERS_PER_TEAM } from './constants';

type FormationType = '4-4-2' | '4-3-3';
type FormationConfig = {
  [key in Exclude<PlayerRoleType, 'Comodín'>]: number;
};

const FORMATIONS: Record<FormationType, FormationConfig> = {
  '4-4-2': {
    Arquero: 1,
    Defensor: 4,
    Mediocampo: 4,
    Delantero: 3,
  },
  '4-3-3': {
    Arquero: 1,
    Defensor: 4,
    Mediocampo: 3,
    Delantero: 3,
  },
};

const isValidRole = (
  role: PlayerRoleType
): role is Exclude<PlayerRoleType, 'Comodín'> => {
  return role !== 'Comodín';
};

// Función para asignar roles de manera flexible respetando formaciones
export const assignFlexibleRole = (
  team: Member[],
  availableRoles: PlayerRoleType[],
  player?: Member,
  previousRole?: PlayerRoleType,
  formation: FormationType = '4-4-2'
): PlayerRoleType => {
  const formationConfig = FORMATIONS[formation];

  // Contar cuántos jugadores hay por posición en el equipo actual
  const roleCounts = {
    Arquero: team.filter((p) => p.assignedRole === 'Arquero').length,
    Defensor: team.filter((p) => p.assignedRole === 'Defensor').length,
    Mediocampo: team.filter((p) => p.assignedRole === 'Mediocampo').length,
    Delantero: team.filter((p) => p.assignedRole === 'Delantero').length,
  };

  // Si ya hay un arquero, no asignar más arqueros
  if (roleCounts.Arquero >= MAX_GOALKEEPERS_PER_TEAM) {
    availableRoles = availableRoles.filter((role) => role !== 'Arquero');
  }

  // Posiciones de campo (no arquero)
  const nonGkPositions = ['Defensor', 'Mediocampo', 'Delantero'] as const;
  type FieldPosition = (typeof nonGkPositions)[number];

  // Encontrar posiciones que necesitan ser cubiertas según la formación
  const neededPositions = nonGkPositions.filter(
    (role) => roleCounts[role] < formationConfig[role]
  );

  // Si hay posiciones que necesitan ser cubiertas, intentar asignar una de ellas
  if (neededPositions.length > 0) {
    // Si el jugador tiene alguna de las posiciones necesitadas como preferencia, asignarla
    if (player?.playerRoles) {
      const playerPreferredRoles = player.playerRoles.map((pr) =>
        typeof pr === 'string' ? pr : pr.role
      ) as PlayerRoleType[];

      const preferredNeededRole = neededPositions.find((role) =>
        playerPreferredRoles.includes(role)
      );

      if (preferredNeededRole) {
        return preferredNeededRole;
      }
    }

    // Si no tiene preferencia por ninguna posición necesitada,
    // asignar la posición más necesitada según la formación
    let mostNeededRole = neededPositions[0];
    let maxDeficit =
      formationConfig[mostNeededRole] - roleCounts[mostNeededRole];

    for (const role of neededPositions) {
      const deficit = formationConfig[role] - roleCounts[role];
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        mostNeededRole = role;
      }
    }

    return mostNeededRole;
  }

  // Si no hay posiciones que necesiten ser cubiertas y el jugador tiene roles preferidos,
  // intentar asignar uno de sus roles preferidos que mantenga el balance
  if (player?.playerRoles) {
    const playerPreferredRoles = player.playerRoles.map((pr) =>
      typeof pr === 'string' ? pr : pr.role
    ) as PlayerRoleType[];

    for (const role of playerPreferredRoles) {
      if (isValidRole(role) && roleCounts[role] <= formationConfig[role]) {
        return role;
      }
    }
  }

  // Solo usar comodín si realmente no hay otra opción viable
  return 'Comodín';
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

  return [...players].sort((a, b) => {
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
