import { Member, BalanceStrategy, TeamBuilderOptions } from './types';
import {
  RoleBalanceStrategy,
  AgeBalanceStrategy,
  SkillBalanceStrategy,
  CombinedBalanceStrategy,
} from './strategies';
import { ROLE_PRIORITY, getPrimaryRole } from './constants';

// Clase principal para construir equipos
export class TeamBuilder {
  private players: Member[];
  private strategies: BalanceStrategy[] = [];
  private teamA: Member[] = [];
  private teamB: Member[] = [];
  private playersByRole: Record<string, Member[]> = {};
  private playersWithoutRole: Member[] = [];

  constructor(players: Member[]) {
    this.players = [...players]; // Copia defensiva
  }

  // Configurar las estrategias según las opciones seleccionadas
  configure(options: TeamBuilderOptions): TeamBuilder {
    // Limpiar estrategias existentes
    this.strategies = [];

    // Determinar qué estrategias aplicar según los checkboxes
    if (
      options.balanceByRole &&
      options.balanceByAge &&
      options.balanceByRating
    ) {
      // Si todos los criterios están seleccionados, usar la estrategia combinada
      this.addStrategy(new CombinedBalanceStrategy());
    } else {
      // Añadir estrategias individuales según lo seleccionado
      if (options.balanceByRole) {
        this.addStrategy(new RoleBalanceStrategy());
      }

      if (options.balanceByAge) {
        this.addStrategy(new AgeBalanceStrategy());
      }

      if (options.balanceByRating) {
        this.addStrategy(new SkillBalanceStrategy());
      }
    }

    return this;
  }

  // Agregar una estrategia de equilibrio específica
  addStrategy(strategy: BalanceStrategy): TeamBuilder {
    this.strategies.push(strategy);
    return this;
  }

  // Método principal para construir equipos
  buildTeams(): [Member[], Member[]] {
    // Resetear equipos
    this.teamA = [];
    this.teamB = [];

    if (this.strategies.length === 0) {
      // Si no hay estrategias, usar formación aleatoria
      this.applyRandomFormation();
    } else {
      // Clasificar jugadores por roles para las estrategias que lo necesiten
      this.classifyPlayersByRoles();

      // Aplicar las estrategias en orden
      this.strategies.forEach((strategy) => {
        strategy.applyStrategy(
          this.players,
          this.teamA,
          this.teamB,
          this.playersByRole,
          this.playersWithoutRole
        );
      });
    }

    // Asegurar que ambos equipos tengan la misma cantidad de jugadores reales
    this.ensureEvenRealPlayerDistribution();

    // Ordenar los equipos por posición (requerido)
    this.sortTeamsByPosition();

    return [this.teamA, this.teamB];
  }

  // Método para formación aleatoria cuando no hay estrategias
  private applyRandomFormation(): void {
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    const halfLength = Math.ceil(shuffled.length / 2);

    this.teamA = shuffled.slice(0, halfLength);
    this.teamB = shuffled.slice(halfLength);
  }

  // Método para clasificar jugadores por rol
  private classifyPlayersByRoles(): void {
    this.playersByRole = {};
    this.playersWithoutRole = [];

    // Clasificar jugadores según su rol principal
    this.players.forEach((player) => {
      const primaryRole = getPrimaryRole(player.playerRoles);
      if (primaryRole) {
        if (!this.playersByRole[primaryRole]) {
          this.playersByRole[primaryRole] = [];
        }
        this.playersByRole[primaryRole].push(player);
      } else {
        this.playersWithoutRole.push(player);
      }
    });
  }

  // Método para asegurar que ambos equipos tengan la misma cantidad de jugadores reales
  private ensureEvenRealPlayerDistribution(): void {
    // Identificar jugadores reales vs TBD en cada equipo
    const realPlayersA = this.teamA.filter(
      (p) => p && p.id && !p.id.toString().startsWith('tbd-')
    );
    const realPlayersB = this.teamB.filter(
      (p) => p && p.id && !p.id.toString().startsWith('tbd-')
    );

    // Verificar si hay desbalance de jugadores reales
    const realPlayerDiff = Math.abs(realPlayersA.length - realPlayersB.length);

    if (realPlayerDiff > 1) {
      console.log(
        `Corrigiendo desbalance de jugadores reales: A=${realPlayersA.length}, B=${realPlayersB.length}`
      );

      // Determinar qué equipo tiene más jugadores reales
      const sourceTeam =
        realPlayersA.length > realPlayersB.length ? realPlayersA : realPlayersB;
      const targetTeam =
        realPlayersA.length > realPlayersB.length ? realPlayersB : realPlayersA;
      const movingFromAtoB = realPlayersA.length > realPlayersB.length;

      // Calcular cuántos jugadores reales mover
      const playersToMove = Math.floor(realPlayerDiff / 2);

      // Realizar las transferencias
      for (let i = 0; i < playersToMove; i++) {
        if (sourceTeam.length > 0) {
          // Obtener un jugador para mover (aleatorio para evitar patrones)
          const playerIndex = Math.floor(Math.random() * sourceTeam.length);
          const playerToMove = sourceTeam.splice(playerIndex, 1)[0];
          targetTeam.push(playerToMove);

          // Actualizar los arrays originales
          if (movingFromAtoB) {
            // Eliminar de A
            const indexInTeamA = this.teamA.findIndex(
              (p) => p.id === playerToMove.id
            );
            if (indexInTeamA !== -1) {
              this.teamA.splice(indexInTeamA, 1);
              this.teamB.push(playerToMove);
            }
          } else {
            // Eliminar de B
            const indexInTeamB = this.teamB.findIndex(
              (p) => p.id === playerToMove.id
            );
            if (indexInTeamB !== -1) {
              this.teamB.splice(indexInTeamB, 1);
              this.teamA.push(playerToMove);
            }
          }
        }
      }

      console.log(
        `Balance final de jugadores reales: A=${
          this.teamA.filter(
            (p) => p && p.id && !p.id.toString().startsWith('tbd-')
          ).length
        }, B=${
          this.teamB.filter(
            (p) => p && p.id && !p.id.toString().startsWith('tbd-')
          ).length
        }`
      );
    }
  }

  // Método para ordenar equipos por posición
  private sortTeamsByPosition(): void {
    this.teamA = this.sortPlayersByRole(this.teamA);
    this.teamB = this.sortPlayersByRole(this.teamB);
  }

  // Utilidad para ordenar jugadores por rol
  private sortPlayersByRole(players: Member[]): Member[] {
    if (!players || !Array.isArray(players)) return players;

    return [...players].sort((a, b) => {
      const getRolePriority = (player: Member) => {
        // Priorizar el rol asignado si existe
        if (
          player.assignedRole &&
          ROLE_PRIORITY[player.assignedRole] !== undefined
        ) {
          return ROLE_PRIORITY[player.assignedRole];
        }

        // Si no hay rol asignado, buscar en playerRoles
        if (player.playerRoles && player.playerRoles.length > 0) {
          const primaryRole = getPrimaryRole(player.playerRoles);
          return primaryRole ? ROLE_PRIORITY[primaryRole] ?? 999 : 999;
        }

        // Si no tiene roles, asignar prioridad baja
        return 999;
      };

      const priorityA = getRolePriority(a);
      const priorityB = getRolePriority(b);

      // Ordenar por prioridad de rol
      return priorityA - priorityB;
    });
  }
}
