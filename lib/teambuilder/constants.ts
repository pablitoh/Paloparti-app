import { PlayerRole, PlayerRoleType } from './types';

// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero' as PlayerRoleType,
  DEFENDER: 'Defensor' as PlayerRoleType,
  MIDFIELDER: 'Mediocampo' as PlayerRoleType,
  FORWARD: 'Delantero' as PlayerRoleType,
  WILDCARD: 'Comodín' as PlayerRoleType,
} as const;

// Valores de prioridad para roles (menor número = mayor prioridad)
// Solo se usa para fallback cuando no hay prioridad de usuario
export const ROLE_PRIORITY: Record<PlayerRoleType, number> = {
  Arquero: 0,
  Defensor: 1,
  Mediocampo: 2,
  Delantero: 3,
  Comodín: 4,
};

// Formaciones mínimas garantizadas
export const MINIMUM_FORMATIONS = {
  '4-3-3': {
    GOALKEEPER: 1,
    DEFENDERS: 4,
    MIDFIELDERS: 3,
    FORWARDS: 3,
    TOTAL: 11,
  },
  '4-4-2': {
    GOALKEEPER: 1,
    DEFENDERS: 4,
    MIDFIELDERS: 4,
    FORWARDS: 2,
    TOTAL: 11,
  },
};

// Constantes para la formación por defecto (4-3-3)
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
export const POSITION_ASSIGNMENT_PATTERN: PlayerRoleType[] = [
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

// Utilidad para obtener el rol principal de un jugador
export const getPrimaryRole = (
  playerRoles?: PlayerRole[]
): PlayerRoleType | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;
  return playerRoles[0].role;
};

// Utilidad para normalizar roles
export const normalizePlayerRoles = (
  playerRoles?: PlayerRole[]
): PlayerRole[] => {
  if (!playerRoles || playerRoles.length === 0) return [];
  return playerRoles;
};
