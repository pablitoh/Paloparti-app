// Tipo Member para representar a un jugador
export type Member = {
  id: string;
  name: string | null;
  birthdate: Date | null;
  age: number | null;
  role: string;
  playerRoles?: string[] | PlayerRole[]; // Backward compatibility + new format
  assignedRole?: string; // Rol asignado para la formación
  starRating?: number; // Nivel de habilidad del jugador (0-5)
};

// Nueva estructura para posiciones con prioridad
export interface PlayerRole {
  role: string;
  priority: number; // 1 = mayor prioridad, 2 = segunda prioridad, etc.
}

// Interfaz para las estrategias de equilibrio
export interface BalanceStrategy {
  name: string;
  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    playersByRole?: Record<string, Member[]>,
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
