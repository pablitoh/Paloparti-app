import {
  Member,
  BalanceStrategy,
  TeamBuilderOptions,
  PlayerRole,
  PlayerRoleType,
} from './types';
import {
  RoleBalanceStrategy,
  AgeBalanceStrategy,
  SkillBalanceStrategy,
  CombinedBalanceStrategy,
} from './strategies';
import {
  ROLE_PRIORITY,
  getPrimaryRole,
  PLAYER_ROLES,
  normalizePlayerRoles,
} from './constants';

// Clase principal para construir equipos
export class TeamBuilder {
  private players: Member[];
  private strategies: BalanceStrategy[] = [];
  private teamA: Member[] = [];
  private teamB: Member[] = [];
  private playersByRole: Record<string, Member[]> = {};
  private playersWithoutRole: Member[] = [];
  private balanceStrategy: CombinedBalanceStrategy;
  private config: {
    balanceByRole: boolean;
    balanceByAge: boolean;
    balanceByRating: boolean;
  };

  constructor(players: Member[]) {
    this.players = players;
    this.balanceStrategy = new CombinedBalanceStrategy();
    this.config = {
      balanceByRole: true,
      balanceByAge: true,
      balanceByRating: true,
    };
  }

  // Configurar las estrategias según las opciones seleccionadas
  configure(config: {
    balanceByRole: boolean;
    balanceByAge: boolean;
    balanceByRating: boolean;
  }): TeamBuilder {
    this.config = config;
    return this;
  }

  // Agregar una estrategia de equilibrio específica
  addStrategy(strategy: BalanceStrategy): TeamBuilder {
    this.strategies.push(strategy);
    return this;
  }

  // Método principal para construir equipos
  buildTeams(): [Member[], Member[]] {
    const teamA: Member[] = [];
    const teamB: Member[] = [];

    // Copia de jugadores para no modificar el original
    let remainingPlayers = [...this.players];

    // Distribuir jugadores forzados primero
    const forcedPlayers = remainingPlayers.filter((p) => p.positionForced);
    remainingPlayers = remainingPlayers.filter((p) => !p.positionForced);

    // Asignar jugadores forzados manteniendo sus roles
    forcedPlayers.forEach((player, index) => {
      const assignedPlayer = { ...player, assignedRole: player.role };
      if (index % 2 === 0) {
        teamA.push(assignedPlayer);
      } else {
        teamB.push(assignedPlayer);
      }
    });

    // Asignar arqueros
    if (this.config.balanceByRole) {
      this.assignGoalkeepers(remainingPlayers, teamA, teamB);
    }

    // Distribuir jugadores restantes
    if (this.config.balanceByRole) {
      this.distributeByRole(remainingPlayers, teamA, teamB);
    } else {
      this.distributePlayersEvenly(remainingPlayers, teamA, teamB);
    }

    // Balancear por edad y rating si está configurado
    if (this.config.balanceByAge || this.config.balanceByRating) {
      this.balanceTeams(teamA, teamB);
    }

    return [teamA, teamB];
  }

  private shufflePlayers(players: Member[]): Member[] {
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private distributePlayersEvenly(
    players: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    const shuffledPlayers = this.shufflePlayers(players);
    shuffledPlayers.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  }

  private findBestPlayerForRole(
    players: Member[],
    role: PlayerRoleType,
    team: Member[]
  ): Member | null {
    const shuffledPlayers = this.shufflePlayers(players);
    return (
      shuffledPlayers.find((p) => p.role === role) ||
      shuffledPlayers.find((p) =>
        p.playerRoles?.some((r) => r.role === role)
      ) ||
      null
    );
  }

  private findBestPlayerForBalance(
    players: Member[],
    team: Member[],
    otherTeam: Member[]
  ): Member | null {
    if (players.length === 0) return null;

    const shuffledPlayers = this.shufflePlayers(players);

    const getAverages = (team: Member[]) => ({
      age: team.reduce((sum, p) => sum + (p.age || 0), 0) / team.length,
      rating:
        team.reduce((sum, p) => sum + (p.starRating || 0), 0) / team.length,
    });

    const teamAvg = getAverages(team);
    const otherTeamAvg = getAverages(otherTeam);

    let bestPlayer = shuffledPlayers[0];
    let minDiff = Infinity;

    shuffledPlayers.forEach((player) => {
      const newTeamAvg = getAverages([...team, player]);
      const ageDiff = Math.abs(newTeamAvg.age - otherTeamAvg.age);
      const ratingDiff = Math.abs(newTeamAvg.rating - otherTeamAvg.rating);
      const totalDiff = ageDiff + ratingDiff;

      if (totalDiff < minDiff) {
        minDiff = totalDiff;
        bestPlayer = player;
      }
    });

    return bestPlayer;
  }

  private assignGoalkeepers(
    players: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    const goalkeepers = players.filter(
      (p) =>
        p.role === 'Arquero' || p.playerRoles?.some((r) => r.role === 'Arquero')
    );

    if (goalkeepers.length >= 2) {
      // Si hay suficientes arqueros, asignar uno a cada equipo
      const shuffledGoalkeepers = this.shufflePlayers(goalkeepers);
      teamA.push({ ...shuffledGoalkeepers[0], assignedRole: 'Arquero' });
      teamB.push({ ...shuffledGoalkeepers[1], assignedRole: 'Arquero' });

      // Remover los arqueros asignados de la lista de jugadores
      players.splice(players.indexOf(goalkeepers[0]), 1);
      players.splice(players.indexOf(goalkeepers[1]), 1);
    } else {
      // Si no hay suficientes arqueros, buscar candidatos
      const candidate1 = this.findGoalkeeperCandidate(players);
      const candidate2 = this.findGoalkeeperCandidate(
        players.filter((p) => p !== candidate1)
      );

      if (candidate1) {
        teamA.push({ ...candidate1, assignedRole: 'Arquero' });
        players.splice(players.indexOf(candidate1), 1);
      }
      if (candidate2) {
        teamB.push({ ...candidate2, assignedRole: 'Arquero' });
        players.splice(players.indexOf(candidate2), 1);
      }
    }
  }

  private findGoalkeeperCandidate(players: Member[]): Member | null {
    // Buscar en este orden: Defensor -> Mediocampista -> Delantero -> Comodín
    const roles: PlayerRoleType[] = [
      'Defensor',
      'Mediocampo',
      'Delantero',
      'Comodín',
    ];

    const shuffledPlayers = this.shufflePlayers(players);
    for (const role of roles) {
      const candidate = shuffledPlayers.find((p) => p.role === role);
      if (candidate) return candidate;
    }

    return shuffledPlayers[0] || null;
  }

  private distributeByRole(
    players: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    const formation =
      players.length >= 22
        ? {
            DEFENDERS: 4,
            MIDFIELDERS: 3,
            FORWARDS: 3,
          }
        : {
            DEFENDERS: Math.floor((players.length - 2) * 0.4),
            MIDFIELDERS: Math.floor((players.length - 2) * 0.3),
            FORWARDS: Math.ceil((players.length - 2) * 0.3),
          };

    // Clasificar jugadores por rol
    const playersByRole: Record<PlayerRoleType, Member[]> = {
      Arquero: [],
      Defensor: [],
      Mediocampo: [],
      Delantero: [],
      Comodín: [],
    };

    players.forEach((player) => {
      const role = (player.role as PlayerRoleType) || 'Comodín';
      playersByRole[role].push(player);
    });

    // Distribuir por rol
    const roles: PlayerRoleType[] = ['Defensor', 'Mediocampo', 'Delantero'];

    roles.forEach((role) => {
      const playersInRole = playersByRole[role] || [];
      const targetCount =
        formation[
          role === 'Defensor'
            ? 'DEFENDERS'
            : role === 'Mediocampo'
            ? 'MIDFIELDERS'
            : 'FORWARDS'
        ];

      const shuffledPlayers = this.shufflePlayers(playersInRole);
      for (
        let i = 0;
        i < Math.min(shuffledPlayers.length, targetCount * 2);
        i++
      ) {
        const player = shuffledPlayers[i];
        if (i % 2 === 0) {
          teamA.push({ ...player, assignedRole: role });
        } else {
          teamB.push({ ...player, assignedRole: role });
        }
        players.splice(players.indexOf(player), 1);
      }
    });

    // Distribuir jugadores restantes
    this.distributePlayersEvenly(players, teamA, teamB);
  }

  private balanceTeams(teamA: Member[], teamB: Member[]): void {
    const getAverages = (team: Member[]) => ({
      age: team.reduce((sum, p) => sum + (p.age || 0), 0) / team.length,
      rating:
        team.reduce((sum, p) => sum + (p.starRating || 0), 0) / team.length,
    });

    const avgA = getAverages(teamA);
    const avgB = getAverages(teamB);

    // Si hay desbalance significativo, intentar intercambiar jugadores
    if (
      Math.abs(avgA.age - avgB.age) > 5 ||
      Math.abs(avgA.rating - avgB.rating) > 1
    ) {
      for (let i = 0; i < teamA.length; i++) {
        for (let j = 0; j < teamB.length; j++) {
          // No intercambiar arqueros ni jugadores forzados
          if (
            teamA[i].assignedRole === 'Arquero' ||
            teamB[j].assignedRole === 'Arquero' ||
            teamA[i].positionForced ||
            teamB[j].positionForced
          ) {
            continue;
          }

          // Calcular promedios después del intercambio
          const tempA = [...teamA];
          const tempB = [...teamB];
          [tempA[i], tempB[j]] = [tempB[j], tempA[i]];
          const newAvgA = getAverages(tempA);
          const newAvgB = getAverages(tempB);

          // Si el intercambio mejora el balance, aplicarlo
          if (
            Math.abs(newAvgA.age - newAvgB.age) <
              Math.abs(avgA.age - avgB.age) &&
            Math.abs(newAvgA.rating - newAvgB.rating) <
              Math.abs(avgA.rating - avgB.rating)
          ) {
            [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
            return; // Salir después del primer intercambio exitoso
          }
        }
      }
    }
  }
}
