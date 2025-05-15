// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

// Valores de prioridad para roles (menor número = mayor prioridad)
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

// Utilidad para obtener el rol principal de un jugador
export const getPrimaryRole = (playerRoles?: string[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Encontrar el rol con la prioridad más alta (número más bajo tiene mayor prioridad)
  return playerRoles.reduce((primaryRole, currentRole) => {
    const primaryPriority = ROLE_PRIORITY[primaryRole] ?? 999;
    const currentPriority = ROLE_PRIORITY[currentRole] ?? 999;
    return currentPriority < primaryPriority ? currentRole : primaryRole;
  }, playerRoles[0]);
};
