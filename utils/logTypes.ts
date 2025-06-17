// Tipos de acciones disponibles para logging
export enum LogAction {
  // Acciones de administración de grupo
  TEAM_SORTED = 'TEAM_SORTED',
  TEAM_RESORTED = 'TEAM_RESORTED',
  MATCH_DELETED = 'MATCH_DELETED',
  MATCH_CREATED = 'MATCH_CREATED',
  PLAYER_REPLACED = 'PLAYER_REPLACED',
  PLAYER_SWAPPED = 'PLAYER_SWAPPED',
  ATTENDANCE_RESET = 'ATTENDANCE_RESET',
  GROUP_EDITED = 'GROUP_EDITED',
  MATCH_EDITED = 'MATCH_EDITED',
  ADMIN_ATTENDANCE_UPDATED = 'ADMIN_ATTENDANCE_UPDATED',
  MATCH_COMPLETED = 'MATCH_COMPLETED',
  MEMBER_RATING_UPDATED = 'MEMBER_RATING_UPDATED',
  STAR_RATING_UPDATED = 'STAR_RATING_UPDATED',

  // Acciones de usuarios
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  USER_ATTENDANCE_UPDATED = 'USER_ATTENDANCE_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

  // Resultados de partido
  MATCH_RESULT_ADDED = 'MATCH_RESULT_ADDED',
  MATCH_RESULT_EDITED = 'MATCH_RESULT_EDITED',
}

// Interfaz para objetos de log de grupo
export interface GroupLog {
  id: string;
  groupId: string;
  userId: string;
  action: string;
  details: any;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

// Interfaz para la respuesta paginada de logs
export interface GroupLogsResponse {
  logs: GroupLog[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}
