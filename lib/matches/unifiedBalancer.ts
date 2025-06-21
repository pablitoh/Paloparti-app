import { Member } from './types';
import { PLAYER_ROLES } from './constants';
import { PlayerRole } from '../teambuilder';

// Configuración de formaciones
const FORMATIONS = {
  '4-3-3': {
    [PLAYER_ROLES.GOALKEEPER]: 1,
    [PLAYER_ROLES.DEFENDER]: 4,
    [PLAYER_ROLES.MIDFIELDER]: 3,
    [PLAYER_ROLES.FORWARD]: 3,
    total: 11,
  },
  '4-4-2': {
    [PLAYER_ROLES.GOALKEEPER]: 1,
    [PLAYER_ROLES.DEFENDER]: 4,
    [PLAYER_ROLES.MIDFIELDER]: 4,
    [PLAYER_ROLES.FORWARD]: 2,
    total: 11,
  },
};

// Utilidades para trabajar con roles de jugadores
const getPrimaryRole = (playerRoles?: PlayerRole[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0]?.role;
};

const getSecondaryRole = (playerRoles?: PlayerRole[]): string | undefined => {
  if (!playerRoles || playerRoles.length < 2) return undefined;
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[1]?.role;
};

const hasRole = (
  playerRoles: PlayerRole[] | undefined,
  role: string
): boolean => {
  if (!playerRoles) return false;
  return playerRoles.some((r) => r.role === role);
};

type PositionCount = Record<string, number>;

interface AssignedPlayer extends Member {
  assignedRole: string;
  positionForced: boolean; // Si fue forzado a una posición que no eligió
}

interface BalanceOptions {
  balanceByAge?: boolean;
  balanceByRating?: boolean;
  balanceByRole?: boolean;
}

class UnifiedTeamBalancer {
  private assignedPlayerIds = new Set<string>();
  private teamA: AssignedPlayer[] = [];
  private teamB: AssignedPlayer[] = [];
  private formation: '4-3-3' | '4-4-2' = '4-3-3';

  constructor(private options: BalanceOptions = {}) {
    this.options = {
      balanceByAge: false,
      balanceByRating: false,
      balanceByRole: true,
      ...options,
    };
  }

  // Método principal para crear equipos balanceados
  createBalancedTeams(members: Member[]): [AssignedPlayer[], AssignedPlayer[]] {
    console.log('\n🎯 ===== ALGORITMO UNIFICADO DE BALANCE DE EQUIPOS =====');
    console.log(`📊 Total de jugadores: ${members.length}`);
    console.log(
      `⚙️ Opciones: edad=${this.options.balanceByAge}, rating=${this.options.balanceByRating}, posición=${this.options.balanceByRole}`
    );

    // Reset state
    this.assignedPlayerIds.clear();
    this.teamA = [];
    this.teamB = [];

    // Determinar formación basada en las posiciones disponibles
    this.determineFormation(members);

    // Clasificar jugadores por posiciones
    const playersByPosition = this.classifyPlayersByPosition(members);

    // Fase 1: Asignar arqueros (CRÍTICO - siempre primero)
    this.assignGoalkeepers(playersByPosition);

    // Fase 2: Garantizar al menos 1 de cada posición restante
    this.guaranteeMinimumPositions(playersByPosition);

    // Fase 3: Completar formaciones siguiendo 4-3-3 o 4-4-2
    this.completeFormations(playersByPosition);

    // Fase 4: Distribuir jugadores restantes balanceando por edad/habilidad
    this.distributeRemainingPlayers(playersByPosition);

    // Fase 5: Verificación final y ajustes
    this.finalizeTeams();

    console.log('\n✅ Equipos finales creados:');
    console.log(`   Equipo A: ${this.teamA.length} jugadores`);
    console.log(`   Equipo B: ${this.teamB.length} jugadores`);
    console.log(`   Formación aplicada: ${this.formation}`);

    return [this.teamA, this.teamB];
  }

  private determineFormation(members: Member[]): void {
    // Contar jugadores por posición preferida
    const positionCounts = {
      [PLAYER_ROLES.MIDFIELDER]: 0,
      [PLAYER_ROLES.FORWARD]: 0,
    };

    members.forEach((member) => {
      const primaryRole = getPrimaryRole(member.playerRoles);
      const secondaryRole = getSecondaryRole(member.playerRoles);

      if (primaryRole === PLAYER_ROLES.MIDFIELDER)
        positionCounts[PLAYER_ROLES.MIDFIELDER]++;
      else if (secondaryRole === PLAYER_ROLES.MIDFIELDER)
        positionCounts[PLAYER_ROLES.MIDFIELDER] += 0.5;

      if (primaryRole === PLAYER_ROLES.FORWARD)
        positionCounts[PLAYER_ROLES.FORWARD]++;
      else if (secondaryRole === PLAYER_ROLES.FORWARD)
        positionCounts[PLAYER_ROLES.FORWARD] += 0.5;
    });

    // Usar 4-4-2 si hay más mediocampistas que delanteros
    this.formation =
      positionCounts[PLAYER_ROLES.MIDFIELDER] >
      positionCounts[PLAYER_ROLES.FORWARD]
        ? '4-4-2'
        : '4-3-3';

    console.log(`📋 Formación seleccionada: ${this.formation}`);
    console.log(
      `   Mediocampistas disponibles: ${
        positionCounts[PLAYER_ROLES.MIDFIELDER]
      }`
    );
    console.log(
      `   Delanteros disponibles: ${positionCounts[PLAYER_ROLES.FORWARD]}`
    );
  }

  private classifyPlayersByPosition(members: Member[]) {
    const playersByPosition: Record<
      string,
      {
        primary: Member[];
        secondary: Member[];
        wildcard: Member[];
      }
    > = {
      [PLAYER_ROLES.GOALKEEPER]: { primary: [], secondary: [], wildcard: [] },
      [PLAYER_ROLES.DEFENDER]: { primary: [], secondary: [], wildcard: [] },
      [PLAYER_ROLES.MIDFIELDER]: { primary: [], secondary: [], wildcard: [] },
      [PLAYER_ROLES.FORWARD]: { primary: [], secondary: [], wildcard: [] },
    };

    members.forEach((member) => {
      const primaryRole = getPrimaryRole(member.playerRoles);
      const secondaryRole = getSecondaryRole(member.playerRoles);

      // Si no tiene roles definidos, va a wildcard para todas las posiciones
      if (!primaryRole) {
        Object.keys(playersByPosition).forEach((position) => {
          playersByPosition[position].wildcard.push(member);
        });
        return;
      }

      // Si es comodín, va a wildcard para todas las posiciones
      if (primaryRole === PLAYER_ROLES.WILDCARD) {
        Object.keys(playersByPosition).forEach((position) => {
          playersByPosition[position].wildcard.push(member);
        });
        return;
      }

      // Asignar a posición primaria
      if (playersByPosition[primaryRole]) {
        playersByPosition[primaryRole].primary.push(member);
      }

      // Asignar a posición secundaria si existe
      if (
        secondaryRole &&
        secondaryRole !== PLAYER_ROLES.WILDCARD &&
        playersByPosition[secondaryRole]
      ) {
        playersByPosition[secondaryRole].secondary.push(member);
      }
    });

    console.log('\n📊 Clasificación de jugadores por posición:');
    Object.entries(playersByPosition).forEach(([position, players]) => {
      const total =
        players.primary.length +
        players.secondary.length +
        players.wildcard.length;
      console.log(
        `   ${position}: ${total} total (${players.primary.length} prim, ${players.secondary.length} sec, ${players.wildcard.length} wild)`
      );
    });

    return playersByPosition;
  }

  private assignGoalkeepers(
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🥅 Fase 1: Asignando arqueros...');

    const gkData = playersByPosition[PLAYER_ROLES.GOALKEEPER];
    const candidates: { player: Member; priority: number }[] = [];

    // Prioridad 1: Arqueros primarios
    gkData.primary.forEach((player) => {
      candidates.push({ player, priority: 1 });
    });

    // Prioridad 2: Arqueros secundarios
    gkData.secondary.forEach((player) => {
      candidates.push({ player, priority: 2 });
    });

    // Prioridad 3: Comodines
    gkData.wildcard.forEach((player) => {
      candidates.push({ player, priority: 3 });
    });

    // Si no hay suficientes candidatos, buscar en otras posiciones
    if (candidates.length < 2) {
      console.log(
        '⚠️ No hay suficientes arqueros, buscando en otras posiciones...'
      );

      // Buscar en todas las posiciones jugadores que no han sido asignados
      Object.values(playersByPosition).forEach((positionData) => {
        [
          ...positionData.primary,
          ...positionData.secondary,
          ...positionData.wildcard,
        ].forEach((player) => {
          if (!candidates.some((c) => c.player.id === player.id)) {
            candidates.push({ player, priority: 4 }); // Prioridad 4: Forzado aleatorio
          }
        });
      });
    }

    // Ordenar por prioridad y luego por criterios de balance
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;

      // Criterios de desempate basados en opciones de balance
      if (
        this.options.balanceByRating &&
        a.player.starRating !== b.player.starRating
      ) {
        return (b.player.starRating || 0) - (a.player.starRating || 0);
      }

      if (this.options.balanceByAge && a.player.age !== b.player.age) {
        return (b.player.age || 0) - (a.player.age || 0);
      }

      return 0;
    });

    // Asignar arqueros alternando equipos
    for (let i = 0; i < Math.min(2, candidates.length); i++) {
      const candidate = candidates[i];

      if (this.assignedPlayerIds.has(candidate.player.id)) continue;

      const isTeamA = i % 2 === 0;
      const isForced = candidate.priority > 2;

      this.assignPlayerToTeam(
        candidate.player,
        PLAYER_ROLES.GOALKEEPER,
        isTeamA,
        isForced
      );

      console.log(
        `   ✅ ${candidate.player.name} → Equipo ${
          isTeamA ? 'A' : 'B'
        } (prioridad ${candidate.priority}${isForced ? ' - FORZADO' : ''})`
      );
    }

    // Verificar si cada equipo tiene al menos un arquero
    const teamAGoalkeepers = this.getPositionCount(this.teamA)[
      PLAYER_ROLES.GOALKEEPER
    ];
    const teamBGoalkeepers = this.getPositionCount(this.teamB)[
      PLAYER_ROLES.GOALKEEPER
    ];

    console.log(
      `🔍 Arqueros después de asignación inicial: A=${teamAGoalkeepers}, B=${teamBGoalkeepers}`
    );

    // Si un equipo no tiene arquero, asignar uno de emergencia
    if (teamAGoalkeepers === 0) {
      this.assignEmergencyGoalkeeper(true, playersByPosition); // Equipo A
    }
    if (teamBGoalkeepers === 0) {
      this.assignEmergencyGoalkeeper(false, playersByPosition); // Equipo B
    }
  }

  private assignEmergencyGoalkeeper(
    isTeamA: boolean,
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log(
      `🚨 Asignando arquero de emergencia al equipo ${isTeamA ? 'A' : 'B'}`
    );

    // Buscar cualquier jugador no asignado en todas las posiciones
    const availablePlayers = this.getAllAvailablePlayers(playersByPosition);

    if (availablePlayers.length > 0) {
      // Tomar el primero disponible
      const player = availablePlayers[0];
      this.assignPlayerToTeam(player, PLAYER_ROLES.GOALKEEPER, isTeamA, true);
      console.log(
        `   ✅ ${player.name} → Equipo ${
          isTeamA ? 'A' : 'B'
        } (ARQUERO DE EMERGENCIA)`
      );
    } else {
      console.log(
        `   ❌ No hay jugadores disponibles para arquero de emergencia en equipo ${
          isTeamA ? 'A' : 'B'
        }`
      );
    }
  }

  private guaranteeMinimumPositions(
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🎯 Fase 2: Garantizando al menos 1 de cada posición...');

    const positions = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];

    positions.forEach((position) => {
      const teamACount = this.getPositionCount(this.teamA)[position];
      const teamBCount = this.getPositionCount(this.teamB)[position];

      // Asegurar que cada equipo tenga al menos 1 de esta posición
      if (teamACount === 0) {
        this.assignBestPlayerForPosition(position, playersByPosition, true);
      }
      if (teamBCount === 0) {
        this.assignBestPlayerForPosition(position, playersByPosition, false);
      }
    });
  }

  private completeFormations(
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🏗️ Fase 3: Completando formaciones...');

    const targetFormation = FORMATIONS[this.formation];
    const positions = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];

    positions.forEach((position) => {
      const needed = targetFormation[position];
      const teamACount = this.getPositionCount(this.teamA)[position];
      const teamBCount = this.getPositionCount(this.teamB)[position];

      // Completar equipo A
      for (let i = teamACount; i < needed; i++) {
        this.assignBestPlayerForPosition(position, playersByPosition, true);
      }

      // Completar equipo B
      for (let i = teamBCount; i < needed; i++) {
        this.assignBestPlayerForPosition(position, playersByPosition, false);
      }
    });
  }

  private assignBestPlayerForPosition(
    position: string,
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >,
    isTeamA: boolean
  ): void {
    const positionData = playersByPosition[position];

    // Buscar el mejor candidato siguiendo el orden de prioridad
    let bestCandidate: { player: Member; priority: number } | null = null;

    // Prioridad 1: Jugadores con esta posición como primaria
    for (const player of positionData.primary) {
      if (!this.assignedPlayerIds.has(player.id)) {
        bestCandidate = { player, priority: 1 };
        break;
      }
    }

    // Prioridad 2: Jugadores con esta posición como secundaria
    if (!bestCandidate) {
      for (const player of positionData.secondary) {
        if (!this.assignedPlayerIds.has(player.id)) {
          bestCandidate = { player, priority: 2 };
          break;
        }
      }
    }

    // Prioridad 3: Jugadores comodín
    if (!bestCandidate) {
      for (const player of positionData.wildcard) {
        if (!this.assignedPlayerIds.has(player.id)) {
          bestCandidate = { player, priority: 3 };
          break;
        }
      }
    }

    // Prioridad 4: Cualquier jugador disponible (forzado)
    if (!bestCandidate) {
      const allAvailable = this.getAllAvailablePlayers(playersByPosition);
      if (allAvailable.length > 0) {
        bestCandidate = { player: allAvailable[0], priority: 4 };
      }
    }

    if (bestCandidate) {
      const isForced = bestCandidate.priority > 2;
      this.assignPlayerToTeam(
        bestCandidate.player,
        position,
        isTeamA,
        isForced
      );

      console.log(
        `   ✅ ${bestCandidate.player.name} → ${position} (Equipo ${
          isTeamA ? 'A' : 'B'
        }, prioridad ${bestCandidate.priority}${isForced ? ' - FORZADO' : ''})`
      );
    }
  }

  private distributeRemainingPlayers(
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🔄 Fase 4: Distribuyendo jugadores restantes...');

    const remainingPlayers = this.getAllAvailablePlayers(playersByPosition);

    if (remainingPlayers.length === 0) {
      console.log('   ✅ No hay jugadores restantes');
      return;
    }

    console.log(`   📊 Jugadores restantes: ${remainingPlayers.length}`);

    // Ordenar por criterios de balance
    const sortedPlayers = this.sortPlayersByBalanceCriteria(remainingPlayers);

    // Distribuir alternando equipos, priorizando balance
    sortedPlayers.forEach((player, index) => {
      const isTeamA = this.shouldAssignToTeamA();
      const bestPosition = this.determineBestPositionForPlayer(player, isTeamA);

      this.assignPlayerToTeam(
        player,
        bestPosition,
        isTeamA,
        !hasRole(player.playerRoles, bestPosition)
      );

      console.log(
        `   ✅ ${player.name} → ${bestPosition} (Equipo ${isTeamA ? 'A' : 'B'})`
      );
    });
  }

  private shouldAssignToTeamA(): boolean {
    // Priorizar el equipo con menos jugadores
    if (this.teamA.length !== this.teamB.length) {
      return this.teamA.length < this.teamB.length;
    }

    // Si están empatados, usar criterios de balance
    if (this.options.balanceByRating) {
      const avgRatingA = this.calculateAverageRating(this.teamA);
      const avgRatingB = this.calculateAverageRating(this.teamB);
      if (avgRatingA !== avgRatingB) {
        return avgRatingA < avgRatingB;
      }
    }

    if (this.options.balanceByAge) {
      const avgAgeA = this.calculateAverageAge(this.teamA);
      const avgAgeB = this.calculateAverageAge(this.teamB);
      if (avgAgeA !== avgAgeB) {
        return avgAgeA < avgAgeB;
      }
    }

    // Por defecto, alternar
    return this.teamA.length % 2 === 0;
  }

  private determineBestPositionForPlayer(
    player: Member,
    isTeamA: boolean
  ): string {
    const team = isTeamA ? this.teamA : this.teamB;
    const currentCounts = this.getPositionCount(team);
    const targetFormation = FORMATIONS[this.formation];

    // Buscar posición preferida del jugador que aún necesite jugadores
    const primaryRole = getPrimaryRole(player.playerRoles);
    const secondaryRole = getSecondaryRole(player.playerRoles);

    if (
      primaryRole &&
      currentCounts[primaryRole] < targetFormation[primaryRole]
    ) {
      return primaryRole;
    }

    if (
      secondaryRole &&
      currentCounts[secondaryRole] < targetFormation[secondaryRole]
    ) {
      return secondaryRole;
    }

    // Si no, buscar la posición que más necesite jugadores
    const positions = [
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];
    const neediest = positions.reduce((min, pos) => {
      const need = targetFormation[pos] - currentCounts[pos];
      const minNeed = targetFormation[min] - currentCounts[min];
      return need > minNeed ? pos : min;
    });

    return neediest;
  }

  private sortPlayersByBalanceCriteria(players: Member[]): Member[] {
    return [...players].sort((a, b) => {
      // Priorizar por rating si está habilitado
      if (this.options.balanceByRating && a.starRating !== b.starRating) {
        return (b.starRating || 0) - (a.starRating || 0);
      }

      // Priorizar por edad si está habilitado
      if (this.options.balanceByAge && a.age !== b.age) {
        return (b.age || 0) - (a.age || 0);
      }

      // Ordenar alfabéticamente como último criterio
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private assignPlayerToTeam(
    player: Member,
    position: string,
    isTeamA: boolean,
    isForced: boolean
  ): void {
    if (this.assignedPlayerIds.has(player.id)) {
      console.warn(`⚠️ Jugador ${player.name} ya estaba asignado, saltando...`);
      return;
    }

    const assignedPlayer: AssignedPlayer = {
      ...player,
      assignedRole: position,
      positionForced: isForced,
    };

    if (isTeamA) {
      this.teamA.push(assignedPlayer);
    } else {
      this.teamB.push(assignedPlayer);
    }

    this.assignedPlayerIds.add(player.id);
  }

  private getAllAvailablePlayers(
    playersByPosition: Record<
      string,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): Member[] {
    const available: Member[] = [];

    Object.values(playersByPosition).forEach((positionData) => {
      [
        ...positionData.primary,
        ...positionData.secondary,
        ...positionData.wildcard,
      ].forEach((player) => {
        if (
          !this.assignedPlayerIds.has(player.id) &&
          !available.some((p) => p.id === player.id)
        ) {
          available.push(player);
        }
      });
    });

    return available;
  }

  private getPositionCount(team: AssignedPlayer[]): PositionCount {
    return {
      [PLAYER_ROLES.GOALKEEPER]: team.filter(
        (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
      ).length,
      [PLAYER_ROLES.DEFENDER]: team.filter(
        (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
      ).length,
      [PLAYER_ROLES.MIDFIELDER]: team.filter(
        (p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER
      ).length,
      [PLAYER_ROLES.FORWARD]: team.filter(
        (p) => p.assignedRole === PLAYER_ROLES.FORWARD
      ).length,
    };
  }

  private calculateAverageRating(team: AssignedPlayer[]): number {
    const ratings = team
      .filter((p) => p.starRating !== null && p.starRating !== undefined)
      .map((p) => p.starRating!);
    return ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0;
  }

  private calculateAverageAge(team: AssignedPlayer[]): number {
    const ages = team
      .filter((p) => p.age !== null && p.age !== undefined)
      .map((p) => p.age!);
    return ages.length > 0
      ? ages.reduce((sum, age) => sum + age, 0) / ages.length
      : 0;
  }

  private convertPlayerToGoalkeeper(isTeamA: boolean): void {
    const team = isTeamA ? this.teamA : this.teamB;

    if (team.length === 0) {
      console.log(
        `❌ No hay jugadores en equipo ${
          isTeamA ? 'A' : 'B'
        } para convertir a arquero`
      );
      return;
    }

    // Buscar el jugador menos impactante para convertir
    // Priorizar jugadores que ya tengan arquero como segunda opción
    let targetPlayer = team.find((player) => {
      const secondaryRole = getSecondaryRole(player.playerRoles);
      return secondaryRole === PLAYER_ROLES.GOALKEEPER;
    });

    // Si no hay nadie con arquero secundario, tomar cualquiera
    if (!targetPlayer) {
      targetPlayer = team[0];
    }

    // Convertir el jugador a arquero
    targetPlayer.assignedRole = PLAYER_ROLES.GOALKEEPER;
    targetPlayer.positionForced = !hasRole(
      targetPlayer.playerRoles,
      PLAYER_ROLES.GOALKEEPER
    );

    console.log(
      `   ✅ ${targetPlayer.name} convertido a arquero en equipo ${
        isTeamA ? 'A' : 'B'
      } ${targetPlayer.positionForced ? '(FORZADO)' : '(SECUNDARIO)'}`
    );
  }

  private finalizeTeams(): void {
    console.log('\n🔍 Fase 5: Verificación final...');

    // Verificar que no hay duplicados
    const allPlayerIds = [
      ...this.teamA.map((p) => p.id),
      ...this.teamB.map((p) => p.id),
    ];
    const uniqueIds = new Set(allPlayerIds);

    if (allPlayerIds.length !== uniqueIds.size) {
      console.error(
        '🚨 ERROR: Se detectaron jugadores duplicados entre equipos'
      );

      // Mostrar duplicados
      const duplicates = allPlayerIds.filter(
        (id, index) => allPlayerIds.indexOf(id) !== index
      );
      console.error('Duplicados encontrados:', duplicates);
    } else {
      console.log('✅ Sin duplicados detectados');
    }

    // Mostrar distribución final
    const teamACount = this.getPositionCount(this.teamA);
    const teamBCount = this.getPositionCount(this.teamB);

    console.log('\n📊 Distribución final:');
    console.log(
      `   Equipo A: GK=${teamACount[PLAYER_ROLES.GOALKEEPER]}, DEF=${
        teamACount[PLAYER_ROLES.DEFENDER]
      }, MID=${teamACount[PLAYER_ROLES.MIDFIELDER]}, FWD=${
        teamACount[PLAYER_ROLES.FORWARD]
      }`
    );
    console.log(
      `   Equipo B: GK=${teamBCount[PLAYER_ROLES.GOALKEEPER]}, DEF=${
        teamBCount[PLAYER_ROLES.DEFENDER]
      }, MID=${teamBCount[PLAYER_ROLES.MIDFIELDER]}, FWD=${
        teamBCount[PLAYER_ROLES.FORWARD]
      }`
    );

    // Verificación de emergencia para arqueros
    if (teamACount[PLAYER_ROLES.GOALKEEPER] === 0) {
      console.log('🚨 EMERGENCIA: Equipo A sin arquero - Convirtiendo jugador');
      this.convertPlayerToGoalkeeper(true);
    }

    if (teamBCount[PLAYER_ROLES.GOALKEEPER] === 0) {
      console.log('🚨 EMERGENCIA: Equipo B sin arquero - Convirtiendo jugador');
      this.convertPlayerToGoalkeeper(false);
    }

    // Mostrar estadísticas de balance
    if (this.options.balanceByRating) {
      console.log(
        `   Rating promedio: A=${this.calculateAverageRating(
          this.teamA
        ).toFixed(1)}, B=${this.calculateAverageRating(this.teamB).toFixed(1)}`
      );
    }

    if (this.options.balanceByAge) {
      console.log(
        `   Edad promedio: A=${this.calculateAverageAge(this.teamA).toFixed(
          1
        )}, B=${this.calculateAverageAge(this.teamB).toFixed(1)}`
      );
    }

    // Contar jugadores forzados
    const forcedA = this.teamA.filter((p) => p.positionForced).length;
    const forcedB = this.teamB.filter((p) => p.positionForced).length;
    console.log(`   Posiciones forzadas: A=${forcedA}, B=${forcedB}`);
  }
}

// Función principal para crear equipos balanceados
export const createUnifiedBalancedTeams = (
  members: Member[],
  options: BalanceOptions = {}
): [AssignedPlayer[], AssignedPlayer[]] => {
  const balancer = new UnifiedTeamBalancer(options);
  return balancer.createBalancedTeams(members);
};
