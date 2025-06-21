// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

// Valores de prioridad para roles (menor número = mayor prioridad)
// Solo se usa para fallback cuando no hay prioridad de usuario
export const ROLE_PRIORITY = {
  [PLAYER_ROLES.GOALKEEPER]: 0,
  [PLAYER_ROLES.DEFENDER]: 1,
  [PLAYER_ROLES.MIDFIELDER]: 2,
  [PLAYER_ROLES.FORWARD]: 3,
  [PLAYER_ROLES.WILDCARD]: 4,
};

// Constantes para la formación 4-3-3
export const FORMATION = {
  GOALKEEPER: 1,
  DEFENDERS: 4,
  MIDFIELDERS: 3,
  FORWARDS: 3,
};

// Configuración para posiciones por jugador
export const POSITION_CONFIG = {
  MAX_POSITIONS: 2, // Configurable
  MIN_POSITIONS: 2, // Configurable
};

// Orden de asignación de posiciones
export const POSITION_ASSIGNMENT_PATTERN = [
  PLAYER_ROLES.GOALKEEPER,
  PLAYER_ROLES.DEFENDER,
  PLAYER_ROLES.MIDFIELDER,
  PLAYER_ROLES.FORWARD,
  PLAYER_ROLES.DEFENDER,
  PLAYER_ROLES.MIDFIELDER,
  PLAYER_ROLES.FORWARD,
  PLAYER_ROLES.DEFENDER,
  PLAYER_ROLES.MIDFIELDER,
  PLAYER_ROLES.FORWARD,
  PLAYER_ROLES.DEFENDER,
];

// Importar PlayerRole del archivo types
import { PlayerRole } from './types';

// Utilidad para obtener el rol principal de un jugador con soporte para prioridades de usuario
export const getPrimaryRole = (
  playerRoles?: string[] | PlayerRole[]
): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Nuevo formato: con prioridad de usuario
  if (
    Array.isArray(playerRoles) &&
    playerRoles.length > 0 &&
    typeof playerRoles[0] === 'object' &&
    'priority' in playerRoles[0]
  ) {
    const rolesWithPriority = playerRoles as PlayerRole[];
    // Ordenar por prioridad (1 = mayor prioridad)
    const sortedRoles = rolesWithPriority.sort(
      (a, b) => a.priority - b.priority
    );
    return sortedRoles[0]?.role;
  }

  // Formato antiguo: usar prioridad hard-coded
  const stringRoles = playerRoles as string[];
  return stringRoles.reduce((primaryRole, currentRole) => {
    const primaryPriority = ROLE_PRIORITY[primaryRole] ?? 999;
    const currentPriority = ROLE_PRIORITY[currentRole] ?? 999;
    return currentPriority < primaryPriority ? currentRole : primaryRole;
  }, stringRoles[0]);
};

// Utilidad para convertir formato antiguo a nuevo formato
export const convertLegacyRoles = (playerRoles: string[]): PlayerRole[] => {
  if (!playerRoles || playerRoles.length === 0) return [];

  // Ordenar por prioridad hard-coded y asignar prioridades de usuario
  const sortedRoles = [...playerRoles].sort((a, b) => {
    const priorityA = ROLE_PRIORITY[a] ?? 999;
    const priorityB = ROLE_PRIORITY[b] ?? 999;
    return priorityA - priorityB;
  });

  return sortedRoles.map((role, index) => ({
    role,
    priority: index + 1,
  }));
};

// Utilidad para normalizar roles (convierte formato antiguo si es necesario)
export const normalizePlayerRoles = (
  playerRoles?: string[] | PlayerRole[]
): PlayerRole[] => {
  if (!playerRoles || playerRoles.length === 0) return [];

  // Si ya está en formato nuevo, devolverlo
  if (
    Array.isArray(playerRoles) &&
    playerRoles.length > 0 &&
    typeof playerRoles[0] === 'object' &&
    'priority' in playerRoles[0]
  ) {
    return playerRoles as PlayerRole[];
  }

  // Convertir formato antiguo
  return convertLegacyRoles(playerRoles as string[]);
};
