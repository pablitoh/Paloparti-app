// Constantes para roles de jugadores (mantener igual que en el frontend)
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

// Eliminar la formación fija - ahora será más flexible
// Solo mantenemos que cada equipo debe tener máximo 1 arquero
export const MAX_GOALKEEPERS_PER_TEAM = 1;
