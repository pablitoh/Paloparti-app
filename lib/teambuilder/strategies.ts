import {
  Member,
  BalanceStrategy,
  BalanceOptions,
  PlayerRole,
  PlayerRoleType,
} from './types';
import {
  PLAYER_ROLES,
  ROLE_PRIORITY,
  FORMATION,
  MINIMUM_FORMATIONS,
  getPrimaryRole,
  POSITION_ASSIGNMENT_PATTERN,
} from './constants';

export interface TeamBalanceStrategy {
  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    options?: BalanceOptions
  ): void;
}

// Estrategia para equilibrar por roles
export class RoleBalanceStrategy implements TeamBalanceStrategy {
  name = 'RoleBalance';

  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    options?: BalanceOptions
  ): void {
    // Inicializar diccionarios con todos los roles posibles
    const playersByPrimaryRole: Record<PlayerRoleType, Member[]> = {
      Arquero: [],
      Defensor: [],
      Mediocampo: [],
      Delantero: [],
      Comodín: [],
    };

    const playersBySecondaryRole: Record<PlayerRoleType, Member[]> = {
      Arquero: [],
      Defensor: [],
      Mediocampo: [],
      Delantero: [],
      Comodín: [],
    };

    players.forEach((player) => {
      if (player.playerRoles && player.playerRoles.length > 0) {
        const roles = player.playerRoles as unknown as PlayerRole[];
        const primaryRole = roles[0]?.role as PlayerRoleType;
        const secondaryRole = roles[1]?.role as PlayerRoleType;

        if (primaryRole) {
          playersByPrimaryRole[primaryRole].push(player);
        }

        if (secondaryRole) {
          playersBySecondaryRole[secondaryRole].push(player);
        }
      }
    });

    // Distribuir arqueros primero
    this.distributeGoalkeepers(
      playersByPrimaryRole,
      playersBySecondaryRole,
      teamA,
      teamB
    );

    // Distribuir defensores respetando la formación
    this.distributeByRole(
      'Defensor',
      FORMATION.DEFENDERS,
      playersByPrimaryRole,
      playersBySecondaryRole,
      teamA,
      teamB
    );

    // Distribuir mediocampistas
    this.distributeByRole(
      'Mediocampo',
      FORMATION.MIDFIELDERS,
      playersByPrimaryRole,
      playersBySecondaryRole,
      teamA,
      teamB
    );

    // Distribuir delanteros
    this.distributeByRole(
      'Delantero',
      FORMATION.FORWARDS,
      playersByPrimaryRole,
      playersBySecondaryRole,
      teamA,
      teamB
    );

    // Balancear calidad dentro de cada rol
    this.balanceQualityByRole(teamA);
    this.balanceQualityByRole(teamB);
  }

  private distributeGoalkeepers(
    primaryRoles: Record<PlayerRoleType, Member[]>,
    secondaryRoles: Record<PlayerRoleType, Member[]>,
    teamA: Member[],
    teamB: Member[]
  ): void {
    const primaryGoalkeepers = primaryRoles['Arquero'] || [];
    const secondaryGoalkeepers = secondaryRoles['Arquero'] || [];

    // Ordenar por rating
    const allGoalkeepers = [
      ...primaryGoalkeepers,
      ...secondaryGoalkeepers,
    ].sort((a, b) => (b.starRating || 0) - (a.starRating || 0));

    if (allGoalkeepers.length >= 2) {
      teamA.push({ ...allGoalkeepers[0], assignedRole: 'Arquero' });
      teamB.push({ ...allGoalkeepers[1], assignedRole: 'Arquero' });
    } else if (allGoalkeepers.length === 1) {
      teamA.push({ ...allGoalkeepers[0], assignedRole: 'Arquero' });
      const candidate = this.findBestGoalkeeperCandidate(primaryRoles);
      if (candidate) {
        teamB.push({ ...candidate, assignedRole: 'Arquero' });
      }
    }
  }

  private distributeByRole(
    role: PlayerRoleType,
    requiredCount: number,
    primaryRoles: Record<PlayerRoleType, Member[]>,
    secondaryRoles: Record<PlayerRoleType, Member[]>,
    teamA: Member[],
    teamB: Member[]
  ): void {
    const primaryPlayers = primaryRoles[role] || [];
    const secondaryPlayers = secondaryRoles[role] || [];

    // Ordenar por rating
    const allPlayers = [...primaryPlayers, ...secondaryPlayers].sort(
      (a, b) => (b.starRating || 0) - (a.starRating || 0)
    );

    // Asegurar distribución equitativa
    const perTeam = Math.min(Math.floor(allPlayers.length / 2), requiredCount);

    for (let i = 0; i < perTeam * 2; i++) {
      const player = allPlayers[i];
      if (player) {
        if (i % 2 === 0) {
          teamA.push({ ...player, assignedRole: role });
        } else {
          teamB.push({ ...player, assignedRole: role });
        }
      }
    }
  }

  private balanceQualityByRole(team: Member[]): void {
    const roleGroups: Record<string, Member[]> = {};

    team.forEach((player) => {
      if (player.assignedRole) {
        if (!roleGroups[player.assignedRole]) {
          roleGroups[player.assignedRole] = [];
        }
        roleGroups[player.assignedRole].push(player);
      }
    });

    // Balancear calidad dentro de cada rol
    Object.values(roleGroups).forEach((players) => {
      players.sort((a, b) => (b.starRating || 0) - (a.starRating || 0));
    });
  }

  private findBestGoalkeeperCandidate(
    primaryRoles: Record<PlayerRoleType, Member[]>
  ): Member | null {
    // Priorizar defensores con mejor rating
    const defenders = primaryRoles['Defensor'] || [];
    if (defenders.length > 0) {
      return defenders.sort(
        (a, b) => (b.starRating || 0) - (a.starRating || 0)
      )[0];
    }
    return null;
  }
}

// Estrategia para equilibrar por edad
export class AgeBalanceStrategy implements TeamBalanceStrategy {
  name = 'AgeBalance';

  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    options?: BalanceOptions
  ): void {
    // Ordenar jugadores por edad
    const sortedPlayers = [...players].sort(
      (a, b) => (b.age || 0) - (a.age || 0)
    );

    // Distribuir alternadamente para mantener balance
    sortedPlayers.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  }
}

// Estrategia para equilibrar por nivel de habilidad
export class SkillBalanceStrategy implements TeamBalanceStrategy {
  name = 'SkillBalance';

  applyStrategy(players: Member[], teamA: Member[], teamB: Member[]): void {
    // Agrupar jugadores por niveles de rating similares
    const playersByRating: Record<number, Member[]> = {};

    // Clasificar jugadores por rating
    players.forEach((member) => {
      const rating =
        member.starRating !== undefined && member.starRating !== null
          ? Math.floor(member.starRating)
          : 3; // Rating por defecto si no está definido

      if (!playersByRating[rating]) {
        playersByRating[rating] = [];
      }
      playersByRating[rating].push(member);
    });

    // Obtener ratings en orden descendente
    const ratings = Object.keys(playersByRating)
      .map(Number)
      .sort((a, b) => b - a);

    // Para cada nivel de rating, mezclar y distribuir
    ratings.forEach((rating) => {
      // Mezclar jugadores con el mismo rating
      const shuffledSameRating = [...playersByRating[rating]].sort(
        () => Math.random() - 0.5
      );

      // Distribuir alternadamente
      shuffledSameRating.forEach((member, index) => {
        if (index % 2 === 0) {
          teamA.push(member);
        } else {
          teamB.push(member);
        }
      });
    });
  }
}

// Estrategia combinada para todos los criterios
export class CombinedBalanceStrategy implements TeamBalanceStrategy {
  name = 'CombinedBalance';

  private roleStrategy: RoleBalanceStrategy;
  private ageStrategy: AgeBalanceStrategy;
  private ratingStrategy: SkillBalanceStrategy;

  constructor() {
    this.roleStrategy = new RoleBalanceStrategy();
    this.ageStrategy = new AgeBalanceStrategy();
    this.ratingStrategy = new SkillBalanceStrategy();
  }

  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    options: BalanceOptions = {}
  ): void {
    const availablePlayers = [...players];

    // Paso 1: Asegurar arqueros
    this.ensureGoalkeepers(availablePlayers, teamA, teamB);

    // Paso 2: Distribuir por roles
    this.distributeByRoles(availablePlayers, teamA, teamB);

    // Paso 3: Balancear por edad y rating
    this.balanceTeams(teamA, teamB);
  }

  private ensureGoalkeepers(
    players: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    const goalkeepers = players.filter(
      (p) =>
        p.role === PLAYER_ROLES.GOALKEEPER ||
        p.playerRoles?.some((r) => r.role === PLAYER_ROLES.GOALKEEPER)
    );

    if (goalkeepers.length >= 2) {
      const gk1 = goalkeepers[0];
      const gk2 = goalkeepers[1];
      teamA.push({ ...gk1, assignedRole: PLAYER_ROLES.GOALKEEPER });
      teamB.push({ ...gk2, assignedRole: PLAYER_ROLES.GOALKEEPER });
      players.splice(players.indexOf(gk1), 1);
      players.splice(players.indexOf(gk2), 1);
    } else if (goalkeepers.length === 1) {
      const gk = goalkeepers[0];
      teamA.push({ ...gk, assignedRole: PLAYER_ROLES.GOALKEEPER });
      players.splice(players.indexOf(gk), 1);

      // Buscar un jugador para convertir en arquero
      const candidate = this.findBestGoalkeeperCandidate(players);
      if (candidate) {
        teamB.push({ ...candidate, assignedRole: PLAYER_ROLES.GOALKEEPER });
        players.splice(players.indexOf(candidate), 1);
      }
    } else {
      // No hay arqueros, buscar dos candidatos
      const candidate1 = this.findBestGoalkeeperCandidate(players);
      if (candidate1) {
        teamA.push({ ...candidate1, assignedRole: PLAYER_ROLES.GOALKEEPER });
        players.splice(players.indexOf(candidate1), 1);
      }

      const candidate2 = this.findBestGoalkeeperCandidate(players);
      if (candidate2) {
        teamB.push({ ...candidate2, assignedRole: PLAYER_ROLES.GOALKEEPER });
        players.splice(players.indexOf(candidate2), 1);
      }
    }
  }

  private findBestGoalkeeperCandidate(players: Member[]): Member | null {
    // Prioridad: Defensor -> Mediocampista -> Delantero -> Comodín
    const roles = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
      PLAYER_ROLES.WILDCARD,
    ];

    for (const role of roles) {
      const candidate = players.find((p) => p.role === role);
      if (candidate) return candidate;
    }

    return players[0] || null;
  }

  private distributeByRoles(
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
    const playersByRole: Record<string, Member[]> = {};
    players.forEach((player) => {
      const role = player.role || PLAYER_ROLES.WILDCARD;
      if (!playersByRole[role]) {
        playersByRole[role] = [];
      }
      playersByRole[role].push(player);
    });

    // Distribuir por rol
    const roles = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];
    roles.forEach((role) => {
      const playersInRole = playersByRole[role] || [];
      const targetCount =
        formation[
          role === PLAYER_ROLES.DEFENDER
            ? 'DEFENDERS'
            : role === PLAYER_ROLES.MIDFIELDER
            ? 'MIDFIELDERS'
            : 'FORWARDS'
        ];

      for (
        let i = 0;
        i < Math.min(playersInRole.length, targetCount * 2);
        i++
      ) {
        const player = playersInRole[i];
        if (i % 2 === 0) {
          teamA.push({ ...player, assignedRole: role });
        } else {
          teamB.push({ ...player, assignedRole: role });
        }
      }
    });

    // Distribuir comodines
    const wildcards = playersByRole[PLAYER_ROLES.WILDCARD] || [];
    wildcards.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  }

  private balanceTeams(teamA: Member[], teamB: Member[]): void {
    // Calcular promedios actuales
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
          // Solo intercambiar si tienen el mismo rol asignado
          if (teamA[i].assignedRole === teamB[j].assignedRole) {
            // Simular intercambio
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
}
