// Tipo Member para representar a un jugador
export type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: PlayerRoleType;
  playerRoles?: PlayerRole[]; // Roles del jugador con prioridades
  assignedRole?: PlayerRoleType; // Rol asignado para la formación
  positionForced?: boolean; // Indica si la posición fue forzada (no es preferida del jugador)
  starRating?: number; // Nivel de habilidad del jugador (0-5)
};

// Tipo literal para roles de jugadores
export type PlayerRoleType =
  | 'Arquero'
  | 'Defensor'
  | 'Mediocampo'
  | 'Delantero'
  | 'Comodín';

// Tipo para roles con prioridad
export interface PlayerRole {
  role: PlayerRoleType;
  priority: number;
}

// Interfaz para las estrategias de equilibrio
export interface BalanceStrategy {
  name: string;
  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    playersByRole?: Record<PlayerRoleType, Member[]>,
    playersWithoutRole?: Member[]
  ): void;
}

// Opciones para la construcción de equipos
export interface TeamBuilderOptions {
  balanceByRole?: boolean;
  balanceByAge?: boolean;
  balanceByRating?: boolean;
  maxPositionsPerPlayer?: number; // Configurable max positions
}

export interface BalanceOptions {
  balanceByRole?: boolean;
  balanceByAge?: boolean;
  balanceByRating?: boolean;
}
