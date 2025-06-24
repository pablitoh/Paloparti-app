import { PlayerRole, PlayerRoleType } from '../teambuilder';

// Interfaces tipo Member
export type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: PlayerRoleType;
  playerRoles?: PlayerRole[]; // Roles elegidos por el usuario con prioridades
  assignedRole?: PlayerRoleType; // Rol asignado para la formación
  positionForced?: boolean; // Indica si la posición fue forzada (no es preferida del jugador)
  starRating?: number; // Nivel de habilidad del jugador (0-5)
};

export interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType: 'TBD';
  playerRoles?: PlayerRole[]; // Roles del jugador
}

// Interfaz para solicitud de crear equipos
export interface TeamFormationRequest {
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
