import { Member, PlayerRoleType } from '../teambuilder/types';
import { PLAYER_ROLES } from './constants';
import { PlayerRole } from '../teambuilder';
import { assignFlexibleRole } from './roleUtils';

// Type assertion to ensure PLAYER_ROLES values match PlayerRoleType
const TYPED_ROLES = {
  GOALKEEPER: 'Arquero' as PlayerRoleType,
  DEFENDER: 'Defensor' as PlayerRoleType,
  MIDFIELDER: 'Mediocampo' as PlayerRoleType,
  FORWARD: 'Delantero' as PlayerRoleType,
  WILDCARD: 'Comodín' as PlayerRoleType,
};

// Type for formations
type Formation = {
  Arquero: number;
  Defensor: number;
  Mediocampo: number;
  Delantero: number;
  Comodín: number;
  total: number;
};

// Configuración de formaciones
const FORMATIONS: Record<'4-3-3' | '4-4-2', Formation> = {
  '4-3-3': {
    Arquero: 1,
    Defensor: 4,
    Mediocampo: 3,
    Delantero: 3,
    Comodín: 0,
    total: 11,
  },
  '4-4-2': {
    Arquero: 1,
    Defensor: 4,
    Mediocampo: 4,
    Delantero: 2,
    Comodín: 0,
    total: 11,
  },
};

// Utilidades para trabajar con roles de jugadores
const getPrimaryRole = (
  playerRoles?: PlayerRole[] | string[]
): PlayerRoleType | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Si es un array de strings
  if (typeof playerRoles[0] === 'string') {
    return playerRoles[0] as PlayerRoleType;
  }

  // Si es un array de objetos PlayerRole, devolver el de mayor prioridad (menor número)
  const roleObjects = playerRoles as PlayerRole[];
  const sortedRoles = [...roleObjects].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0]?.role;
};

const getSecondaryRole = (
  playerRoles?: PlayerRole[] | string[]
): PlayerRoleType | undefined => {
  if (!playerRoles || playerRoles.length < 2) return undefined;

  // Si es un array de strings, devolver el segundo
  if (typeof playerRoles[0] === 'string') {
    return playerRoles[1] as PlayerRoleType;
  }

  // Si es un array de objetos PlayerRole, devolver el segundo de mayor prioridad
  const roleObjects = playerRoles as PlayerRole[];
  const sortedRoles = [...roleObjects].sort((a, b) => a.priority - b.priority);
  return sortedRoles[1]?.role;
};

const hasRole = (
  playerRoles: PlayerRole[] | PlayerRoleType[] | undefined,
  role: PlayerRoleType
): boolean => {
  if (!playerRoles || playerRoles.length === 0) return false;

  // Si es un array de strings (PlayerRoleType)
  if (typeof playerRoles[0] === 'string') {
    return (playerRoles as PlayerRoleType[]).includes(role);
  }

  // Si es un array de objetos PlayerRole
  return (playerRoles as PlayerRole[]).some((r) => r.role === role);
};

type PositionCount = Record<string, number>;

interface AssignedPlayer extends Member {
  assignedRole: PlayerRoleType;
  positionForced: boolean; // Si fue forzado a una posición que no eligió
}

interface BalanceOptions {
  balanceByAge?: boolean;
  balanceByRating?: boolean;
  balanceByRole?: boolean;
  addVariability?: boolean; // Nueva opción para agregar variabilidad
}

// Helper function to convert string role to PlayerRoleType
const toPlayerRoleType = (role: string): PlayerRoleType => {
  switch (role) {
    case PLAYER_ROLES.GOALKEEPER:
      return TYPED_ROLES.GOALKEEPER;
    case PLAYER_ROLES.DEFENDER:
      return TYPED_ROLES.DEFENDER;
    case PLAYER_ROLES.MIDFIELDER:
      return TYPED_ROLES.MIDFIELDER;
    case PLAYER_ROLES.FORWARD:
      return TYPED_ROLES.FORWARD;
    case PLAYER_ROLES.WILDCARD:
      return TYPED_ROLES.WILDCARD;
    default:
      throw new Error(`Invalid role: ${role}`);
  }
};

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
      addVariability: false,
      ...options,
    };
  }

  // Método principal para crear equipos balanceados
  createBalancedTeams(members: Member[]): [AssignedPlayer[], AssignedPlayer[]] {
    console.log('\n🎯 ===== ALGORITMO UNIFICADO MEJORADO =====');
    console.log(`📊 Total de jugadores: ${members.length}`);
    console.log(
      `⚙️ Opciones: edad=${this.options.balanceByAge}, rating=${this.options.balanceByRating}, posición=${this.options.balanceByRole}, variabilidad=${this.options.addVariability}`
    );

    // Reset state
    this.assignedPlayerIds.clear();
    this.teamA = [];
    this.teamB = [];

    // Determinar formación basada en las posiciones disponibles
    this.determineFormation(members);

    // Clasificar jugadores por posición para algoritmo estructurado
    const playersByPosition = this.classifyPlayersByPosition(members);

    // Usar algoritmo estructurado para GARANTIZAR formaciones correctas
    this.assignGoalkeepers(playersByPosition);
    this.balanceTeams(); // Nuevo: Balance después de arqueros

    this.guaranteeMinimumPositions(playersByPosition);
    this.balanceTeams(); // Nuevo: Balance después de posiciones mínimas

    this.completeFormations(playersByPosition);
    this.balanceTeams(); // Nuevo: Balance después de completar formaciones

    this.distributeRemainingPlayers(playersByPosition);
    this.balanceTeams(); // Nuevo: Balance después de distribuir restantes

    // NUEVO: Asegurar que TODOS los jugadores sean asignados
    this.assignAllRemainingPlayers(members);
    this.balanceTeams(); // Nuevo: Balance final

    // Verificación final y ajustes
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
      [TYPED_ROLES.MIDFIELDER]: 0,
      [TYPED_ROLES.FORWARD]: 0,
    };

    members.forEach((member) => {
      const primaryRole = getPrimaryRole(member.playerRoles);
      const secondaryRole = getSecondaryRole(member.playerRoles);

      if (primaryRole === TYPED_ROLES.MIDFIELDER)
        positionCounts[TYPED_ROLES.MIDFIELDER]++;
      else if (secondaryRole === TYPED_ROLES.MIDFIELDER)
        positionCounts[TYPED_ROLES.MIDFIELDER] += 0.5;

      if (primaryRole === TYPED_ROLES.FORWARD)
        positionCounts[TYPED_ROLES.FORWARD]++;
      else if (secondaryRole === TYPED_ROLES.FORWARD)
        positionCounts[TYPED_ROLES.FORWARD] += 0.5;
    });

    // Usar 4-4-2 si hay más mediocampistas que delanteros
    this.formation =
      positionCounts[TYPED_ROLES.MIDFIELDER] >
      positionCounts[TYPED_ROLES.FORWARD]
        ? '4-4-2'
        : '4-3-3';

    console.log(`📋 Formación seleccionada: ${this.formation}`);
    console.log(
      `   Mediocampistas disponibles: ${positionCounts[TYPED_ROLES.MIDFIELDER]}`
    );
    console.log(
      `   Delanteros disponibles: ${positionCounts[TYPED_ROLES.FORWARD]}`
    );
  }

  private performGlobalOptimalAssignment(members: Member[]): void {
    console.log('\n🔍 NUEVO: Análisis global para asignación óptima...');

    const targetFormation = FORMATIONS[this.formation];
    const needed = {
      [TYPED_ROLES.GOALKEEPER]: 2, // 1 por equipo
      [TYPED_ROLES.DEFENDER]: targetFormation['Defensor'] * 2,
      [TYPED_ROLES.MIDFIELDER]: targetFormation['Mediocampo'] * 2,
      [TYPED_ROLES.FORWARD]: targetFormation['Delantero'] * 2,
    };

    console.log('🎯 Posiciones requeridas:', needed);

    // Crear pool de candidatos optimizado por posición
    const candidatesByPosition = this.createOptimizedCandidatePool(members);

    // Asignar posiciones en orden de criticidad: Arqueros > Defensores > Mediocampo > Delanteros
    const positions = [
      TYPED_ROLES.GOALKEEPER,
      TYPED_ROLES.DEFENDER,
      TYPED_ROLES.MIDFIELDER,
      TYPED_ROLES.FORWARD,
    ];

    positions.forEach((position) => {
      const requiredCount = needed[position];
      console.log(`\n🎯 Asignando ${position} (${requiredCount} necesarios):`);

      this.assignPositionWithOptimalPreferences(
        candidatesByPosition[position],
        position,
        requiredCount
      );
    });

    console.log('\n✅ Asignación global completada');
  }

  private createOptimizedCandidatePool(members: Member[]) {
    const pool = {
      [TYPED_ROLES.GOALKEEPER]: [] as Array<{
        player: Member;
        priority: number;
        balanceScore: number;
      }>,
      [TYPED_ROLES.DEFENDER]: [] as Array<{
        player: Member;
        priority: number;
        balanceScore: number;
      }>,
      [TYPED_ROLES.MIDFIELDER]: [] as Array<{
        player: Member;
        priority: number;
        balanceScore: number;
      }>,
      [TYPED_ROLES.FORWARD]: [] as Array<{
        player: Member;
        priority: number;
        balanceScore: number;
      }>,
    };

    members.forEach((member) => {
      const primaryRole = getPrimaryRole(member.playerRoles);
      const secondaryRole = getSecondaryRole(member.playerRoles);
      const balanceScore = this.calculatePlayerBalanceScore(member);

      // Agregar a posición primaria con prioridad 1
      if (primaryRole && pool[primaryRole]) {
        pool[primaryRole].push({
          player: member,
          priority: 1,
          balanceScore,
        });
      }

      // Agregar a posición secundaria con prioridad 2
      if (
        secondaryRole &&
        pool[secondaryRole] &&
        secondaryRole !== primaryRole
      ) {
        pool[secondaryRole].push({
          player: member,
          priority: 2,
          balanceScore,
        });
      }

      // Si no tiene posiciones específicas o es comodín, agregar a todas con prioridad 3
      if (!primaryRole || primaryRole === TYPED_ROLES.WILDCARD) {
        Object.keys(pool).forEach((position) => {
          pool[position].push({
            player: member,
            priority: 3,
            balanceScore,
          });
        });
      }
    });

    // Ordenar cada pool por prioridad y luego por balance
    Object.keys(pool).forEach((position) => {
      pool[position].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.balanceScore - a.balanceScore; // Mayor balance primero
      });

      console.log(
        `📊 ${position}: ${pool[position].length} candidatos (${
          pool[position].filter((c) => c.priority === 1).length
        } prim, ${pool[position].filter((c) => c.priority === 2).length} sec, ${
          pool[position].filter((c) => c.priority === 3).length
        } wild)`
      );
    });

    return pool;
  }

  private calculatePlayerBalanceScore(player: Member): number {
    let score = 0;

    if (this.options.balanceByRating && player.starRating) {
      score += player.starRating * 2;
    }

    if (this.options.balanceByAge && player.age) {
      // Normalizar edad (18-45)
      const normalizedAge = Math.max(
        0,
        Math.min(1, (player.age - 18) / (45 - 18))
      );
      score += normalizedAge * 1;
    }

    return score;
  }

  private assignPositionWithOptimalPreferences(
    candidates: Array<{
      player: Member;
      priority: number;
      balanceScore: number;
    }>,
    position: PlayerRoleType,
    needed: number
  ): void {
    // Ordenar candidatos por prioridad y balance
    const sortedCandidates = [...candidates].sort((a, b) => {
      // Primero por prioridad
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Luego por balance score
      return b.balanceScore - a.balanceScore;
    });

    // Asignar los mejores candidatos
    let assigned = 0;
    for (const candidate of sortedCandidates) {
      if (assigned >= needed) break;
      if (this.assignedPlayerIds.has(candidate.player.id)) continue;

      const isTeamA = this.shouldAssignToTeamA();
      const isForced = !this.hasRole(candidate.player, position);

      this.assignPlayerToTeam(candidate.player, position, isTeamA, isForced);
      assigned++;
    }
  }

  private classifyPlayersByPosition(members: Member[]) {
    const playersByPosition: Record<
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    > = {
      Arquero: { primary: [], secondary: [], wildcard: [] },
      Defensor: { primary: [], secondary: [], wildcard: [] },
      Mediocampo: { primary: [], secondary: [], wildcard: [] },
      Delantero: { primary: [], secondary: [], wildcard: [] },
      Comodín: { primary: [], secondary: [], wildcard: [] },
    };

    members.forEach((member) => {
      const primaryRole = getPrimaryRole(member.playerRoles);
      const secondaryRole = getSecondaryRole(member.playerRoles);

      // Si no tiene roles específicos o es comodín, va a wildcard para todas las posiciones
      if (!primaryRole || primaryRole === TYPED_ROLES.WILDCARD) {
        Object.keys(playersByPosition).forEach((position) => {
          playersByPosition[position as PlayerRoleType].wildcard.push(member);
        });
        return;
      }

      // Asignar rol primario
      if (playersByPosition[primaryRole as PlayerRoleType]) {
        playersByPosition[primaryRole as PlayerRoleType].primary.push(member);
      }

      // Asignar rol secundario si existe y no es comodín
      if (
        secondaryRole &&
        secondaryRole !== TYPED_ROLES.WILDCARD &&
        playersByPosition[secondaryRole as PlayerRoleType]
      ) {
        playersByPosition[secondaryRole as PlayerRoleType].secondary.push(
          member
        );
      }
    });

    return playersByPosition;
  }

  private assignGoalkeepers(
    playersByPosition: Record<
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🥅 Fase 1: Asignando arqueros...');

    const gkData = playersByPosition[TYPED_ROLES.GOALKEEPER];
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

      // Si hay empate y se activó la variabilidad, agregar aleatoriedad
      if (this.options.addVariability) {
        return Math.random() - 0.5; // Retorna -0.5 a 0.5 aleatoriamente
      }

      return 0;
    });

    // Asignar arqueros alternando equipos
    for (let i = 0; i < Math.min(2, candidates.length); i++) {
      const candidate = candidates[i];

      if (this.assignedPlayerIds.has(candidate.player.id)) continue;

      const isTeamA = i % 2 === 0;
      // CORREGIDO: Solo marcar como forzado si NO tiene arquero entre sus roles
      const isForced = !this.hasRole(candidate.player, TYPED_ROLES.GOALKEEPER);

      this.assignPlayerToTeam(
        candidate.player,
        TYPED_ROLES.GOALKEEPER,
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
      TYPED_ROLES.GOALKEEPER
    ];
    const teamBGoalkeepers = this.getPositionCount(this.teamB)[
      TYPED_ROLES.GOALKEEPER
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
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log(
      `🚨 Asignando arquero de emergencia para equipo ${isTeamA ? 'A' : 'B'}`
    );

    const team = isTeamA ? this.teamA : this.teamB;
    const otherTeam = isTeamA ? this.teamB : this.teamA;

    // Buscar un jugador del otro equipo que tenga arquero como rol secundario
    const candidateFromOtherTeam = otherTeam.find((player) => {
      const secondaryRole = getSecondaryRole(player.playerRoles);
      return secondaryRole === TYPED_ROLES.GOALKEEPER;
    });

    if (candidateFromOtherTeam) {
      // Intercambiar con un jugador del equipo actual
      const playerToSwap = team[0];
      if (playerToSwap) {
        // Actualizar asignaciones
        candidateFromOtherTeam.assignedRole = playerToSwap.assignedRole;
        playerToSwap.assignedRole = TYPED_ROLES.GOALKEEPER;
        playerToSwap.positionForced = !this.hasRole(
          playerToSwap,
          TYPED_ROLES.GOALKEEPER
        );

        // Mover jugadores entre equipos
        const otherTeamIndex = otherTeam.indexOf(candidateFromOtherTeam);
        const teamIndex = team.indexOf(playerToSwap);
        if (otherTeamIndex !== -1 && teamIndex !== -1) {
          otherTeam[otherTeamIndex] = playerToSwap;
          team[teamIndex] = candidateFromOtherTeam;
        }

        console.log(
          `   ✅ Intercambio: ${playerToSwap.name} ↔ ${candidateFromOtherTeam.name}`
        );
        return;
      }
    }

    // Si no se pudo intercambiar, buscar un jugador no asignado
    const availablePlayers = this.getAllAvailablePlayers(playersByPosition);
    if (availablePlayers.length > 0) {
      const player = availablePlayers[0];
      this.assignPlayerToTeam(
        player,
        TYPED_ROLES.GOALKEEPER,
        isTeamA,
        !this.hasRole(player, TYPED_ROLES.GOALKEEPER)
      );
      console.log(`   ✅ Asignado nuevo: ${player.name}`);
      return;
    }

    console.log('   ❌ No se encontró jugador para asignar como arquero');
  }

  private guaranteeMinimumPositions(
    playersByPosition: Record<
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    console.log('\n🎯 Garantizando posiciones mínimas por formación');
    const formation = FORMATIONS[this.formation];

    // Primero asignar roles primarios hasta alcanzar el mínimo requerido
    Object.entries(formation).forEach(([position, required]) => {
      if (position === 'total' || position === 'Comodín') return;
      const positionType = position as PlayerRoleType;
      const neededPerTeam = Math.floor(required / 2);

      console.log(
        `\n📊 Posición ${position}: necesarios ${neededPerTeam} por equipo`
      );

      // Primero intentar con roles primarios
      while (
        this.getPositionCount(this.teamA)[positionType] < neededPerTeam ||
        this.getPositionCount(this.teamB)[positionType] < neededPerTeam
      ) {
        const success = this.assignBestPlayerForPosition(
          positionType,
          playersByPosition,
          this.shouldAssignToTeamA(),
          true,
          true
        );

        if (!success) break;
      }

      // Si no se alcanzó el mínimo con roles primarios, usar secundarios
      while (
        this.getPositionCount(this.teamA)[positionType] < neededPerTeam ||
        this.getPositionCount(this.teamB)[positionType] < neededPerTeam
      ) {
        const success = this.assignBestPlayerForPosition(
          positionType,
          playersByPosition,
          this.shouldAssignToTeamA(),
          false,
          true
        );

        if (!success) {
          // Si no hay más jugadores disponibles para esta posición, intentar convertir comodines
          this.fillPositionWithWildcards(positionType, neededPerTeam);
          break;
        }
      }

      // Verificar y loggear el resultado
      const teamACount = this.getPositionCount(this.teamA)[positionType];
      const teamBCount = this.getPositionCount(this.teamB)[positionType];
      console.log(
        `   ✓ ${position} asignados - Equipo A: ${teamACount}, Equipo B: ${teamBCount}`
      );
    });
  }

  private hasRole(player: Member, role: PlayerRoleType): boolean {
    if (!player.playerRoles || player.playerRoles.length === 0) {
      return false;
    }

    return player.playerRoles.some((playerRole) =>
      typeof playerRole === 'string'
        ? playerRole === role
        : playerRole.role === role
    );
  }

  private fillPositionWithWildcards(
    position: PlayerRoleType,
    neededPerTeam: number
  ): void {
    const formation = FORMATIONS[this.formation];
    const teamACount = this.getPositionCount(this.teamA)[position];
    const teamBCount = this.getPositionCount(this.teamB)[position];

    // Verificar si algún equipo necesita más jugadores en esta posición
    if (teamACount < neededPerTeam || teamBCount < neededPerTeam) {
      const availableWildcards = this.teamA
        .concat(this.teamB)
        .filter(
          (player) =>
            player.assignedRole === TYPED_ROLES.WILDCARD &&
            !this.hasRole(player, position)
        );

      // Distribuir comodines según sea necesario
      availableWildcards.forEach((wildcard) => {
        const currentTeamA = this.teamA.includes(wildcard);
        const targetTeamA = teamACount < neededPerTeam;

        // Si el jugador está en el equipo equivocado, moverlo
        if (currentTeamA !== targetTeamA) {
          if (currentTeamA) {
            this.teamA = this.teamA.filter((p) => p.id !== wildcard.id);
            this.teamB.push({
              ...wildcard,
              assignedRole: position,
              positionForced: true,
            });
          } else {
            this.teamB = this.teamB.filter((p) => p.id !== wildcard.id);
            this.teamA.push({
              ...wildcard,
              assignedRole: position,
              positionForced: true,
            });
          }
        } else {
          // Solo actualizar el rol
          wildcard.assignedRole = position;
          wildcard.positionForced = true;
        }
      });
    }
  }

  private completeFormations(
    playersByPosition: Record<
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >
  ): void {
    const formationConfig = FORMATIONS[this.formation];
    const positions = [
      TYPED_ROLES.DEFENDER,
      TYPED_ROLES.MIDFIELDER,
      TYPED_ROLES.FORWARD,
    ];

    // Completar cada posición hasta alcanzar el número requerido por la formación
    positions.forEach((position) => {
      const requiredPerTeam = Math.floor(formationConfig[position] / 2);

      console.log(
        `\n📊 Completando ${position}: necesarios ${requiredPerTeam} por equipo`
      );

      // Completar equipo A
      const currentTeamA = this.teamA.filter(
        (p) => p.assignedRole === position
      ).length;
      const neededTeamA = Math.max(0, requiredPerTeam - currentTeamA);

      console.log(
        `   Equipo A: tiene ${currentTeamA}, necesita ${neededTeamA} más`
      );

      for (let i = 0; i < neededTeamA; i++) {
        // Intentar primero con roles primarios
        let success = this.assignBestPlayerForPosition(
          position,
          playersByPosition,
          true,
          true, // Solo roles primarios
          false
        );

        // Si no hay primarios disponibles, intentar con secundarios/comodines
        if (!success) {
          success = this.assignBestPlayerForPosition(
            position,
            playersByPosition,
            true,
            false, // Permitir roles secundarios y comodines
            false
          );
        }

        if (!success) {
          console.log(
            `   ⚠️ No hay más jugadores disponibles para ${position}`
          );
          break;
        }
      }

      // Completar equipo B
      const currentTeamB = this.teamB.filter(
        (p) => p.assignedRole === position
      ).length;
      const neededTeamB = Math.max(0, requiredPerTeam - currentTeamB);

      console.log(
        `   Equipo B: tiene ${currentTeamB}, necesita ${neededTeamB} más`
      );

      for (let i = 0; i < neededTeamB; i++) {
        // Intentar primero con roles primarios
        let success = this.assignBestPlayerForPosition(
          position,
          playersByPosition,
          false,
          true, // Solo roles primarios
          false
        );

        // Si no hay primarios disponibles, intentar con secundarios/comodines
        if (!success) {
          success = this.assignBestPlayerForPosition(
            position,
            playersByPosition,
            false,
            false, // Permitir roles secundarios y comodines
            false
          );
        }

        if (!success) {
          console.log(
            `   ⚠️ No hay más jugadores disponibles para ${position}`
          );
          break;
        }
      }

      // Verificar y loggear el resultado final
      const finalTeamACount = this.teamA.filter(
        (p) => p.assignedRole === position
      ).length;
      const finalTeamBCount = this.teamB.filter(
        (p) => p.assignedRole === position
      ).length;

      console.log(
        `   ✓ ${position} final - Equipo A: ${finalTeamACount}, Equipo B: ${finalTeamBCount}`
      );
    });
  }

  private assignBestPlayerForPosition(
    position: PlayerRoleType,
    playersByPosition: Record<
      PlayerRoleType,
      { primary: Member[]; secondary: Member[]; wildcard: Member[] }
    >,
    isTeamA: boolean,
    usePrimaryOnly: boolean,
    isGuaranteePhase: boolean = false
  ): boolean {
    const positionData = playersByPosition[position];
    let bestCandidate: { player: Member; priority: number } | null = null;

    // Función auxiliar para verificar si un jugador puede ser asignado a una posición
    const canAssignToPosition = (
      player: Member,
      checkPrimaryOnly: boolean
    ): boolean => {
      const primaryRole = getPrimaryRole(player.playerRoles);
      const secondaryRole = getSecondaryRole(player.playerRoles);

      if (checkPrimaryOnly) {
        return primaryRole === position;
      }

      return (
        primaryRole === position ||
        secondaryRole === position ||
        primaryRole === TYPED_ROLES.WILDCARD
      );
    };

    // Primero buscar en jugadores primarios
    for (const player of positionData.primary) {
      if (
        !this.assignedPlayerIds.has(player.id) &&
        canAssignToPosition(player, usePrimaryOnly)
      ) {
        bestCandidate = { player, priority: 1 };
        break;
      }
    }

    // Si no encontramos en primarios y no estamos limitados a ellos, buscar en secundarios
    if (!bestCandidate && !usePrimaryOnly) {
      for (const player of positionData.secondary) {
        if (
          !this.assignedPlayerIds.has(player.id) &&
          canAssignToPosition(player, false)
        ) {
          bestCandidate = { player, priority: 2 };
          break;
        }
      }
    }

    // Si aún no encontramos y no estamos limitados a primarios, buscar en comodines
    if (!bestCandidate && !usePrimaryOnly) {
      for (const player of positionData.wildcard) {
        if (!this.assignedPlayerIds.has(player.id)) {
          bestCandidate = { player, priority: 3 };
          break;
        }
      }
    }

    if (bestCandidate) {
      const primaryRole = getPrimaryRole(bestCandidate.player.playerRoles);
      const isForced =
        primaryRole !== position && primaryRole !== TYPED_ROLES.WILDCARD;

      this.assignPlayerToTeam(
        bestCandidate.player,
        position,
        isTeamA,
        isForced
      );

      console.log(
        `   ✅ ${bestCandidate.player.name} → Equipo ${
          isTeamA ? 'A' : 'B'
        } como ${position}${isForced ? ' (FORZADO)' : ''} (prioridad ${
          bestCandidate.priority
        })`
      );

      return true;
    }

    return false;
  }

  private distributeRemainingPlayers(
    playersByPosition: Record<
      PlayerRoleType,
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

    // Obtener la formación objetivo
    const formationConfig = FORMATIONS[this.formation];

    // Distribuir jugadores respetando la formación
    sortedPlayers.forEach((player) => {
      const isTeamA = this.shouldAssignToTeamA();
      const team = isTeamA ? this.teamA : this.teamB;
      const currentCounts = this.getPositionCount(team);

      // Encontrar la posición que más necesita ser completada
      let bestPosition: PlayerRoleType | null = null;
      let maxDeficit = -1;

      Object.entries(formationConfig).forEach(([position, required]) => {
        if (position === 'total' || position === 'Comodín') return;

        const positionType = position as PlayerRoleType;
        const requiredPerTeam = Math.floor(required / 2);
        const current = currentCounts[positionType] || 0;
        const deficit = requiredPerTeam - current;

        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          bestPosition = positionType;
        }
      });

      // Si no hay déficit en ninguna posición, usar la posición preferida del jugador
      if (!bestPosition || maxDeficit <= 0) {
        bestPosition = this.determineBestPositionForPlayer(player, isTeamA);
      }

      // Verificar si el jugador tiene el rol como primario o secundario
      const primaryRole = getPrimaryRole(player.playerRoles);
      const secondaryRole = getSecondaryRole(player.playerRoles);
      const isForced =
        bestPosition !== primaryRole &&
        bestPosition !== secondaryRole &&
        primaryRole !== TYPED_ROLES.WILDCARD;

      this.assignPlayerToTeam(player, bestPosition, isTeamA, isForced);

      console.log(
        `   ✅ ${player.name} → Equipo ${
          isTeamA ? 'A' : 'B'
        } como ${bestPosition}${isForced ? ' (FORZADO)' : ''}`
      );
    });

    // Verificar y loggear el estado final de las posiciones
    console.log('\n📊 Estado final de posiciones:');
    ['Arquero', 'Defensor', 'Mediocampo', 'Delantero'].forEach((position) => {
      const posType = position as PlayerRoleType;
      const teamACount = this.getPositionCount(this.teamA)[posType];
      const teamBCount = this.getPositionCount(this.teamB)[posType];
      console.log(`   ${position}: A=${teamACount}, B=${teamBCount}`);
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

    // Si están completamente empatados y se activó la variabilidad, usar aleatoriedad
    if (this.options.addVariability) {
      return Math.random() > 0.5;
    }

    // Por defecto, alternar
    return this.teamA.length % 2 === 0;
  }

  private determineBestPositionForPlayer(
    player: Member,
    isTeamA: boolean
  ): PlayerRoleType {
    const team = isTeamA ? this.teamA : this.teamB;
    const currentCounts = this.getPositionCount(team);
    const targetFormation = FORMATIONS[this.formation];

    // Buscar posición preferida del jugador que aún necesite jugadores
    const primaryRole = getPrimaryRole(player.playerRoles);
    const secondaryRole = getSecondaryRole(player.playerRoles);

    if (primaryRole) {
      const typedPrimaryRole = toPlayerRoleType(primaryRole);
      if (currentCounts[typedPrimaryRole] < targetFormation[typedPrimaryRole]) {
        return typedPrimaryRole;
      }
    }

    if (secondaryRole) {
      const typedSecondaryRole = toPlayerRoleType(secondaryRole);
      if (
        currentCounts[typedSecondaryRole] < targetFormation[typedSecondaryRole]
      ) {
        return typedSecondaryRole;
      }
    }

    // Si no, buscar la posición que más necesite jugadores
    const positions = [
      TYPED_ROLES.DEFENDER,
      TYPED_ROLES.MIDFIELDER,
      TYPED_ROLES.FORWARD,
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

      // Si hay empate y se activó la variabilidad, agregar aleatoriedad
      if (this.options.addVariability) {
        return Math.random() - 0.5;
      }

      // Ordenar alfabéticamente como último criterio
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private assignPlayerToTeam(
    player: Member,
    position: PlayerRoleType,
    isTeamA: boolean,
    isForced: boolean
  ): void {
    // Obtener el rol anterior del jugador si existe
    const previousRole = player.assignedRole;

    // Determinar los roles disponibles basados en las preferencias del jugador
    const availableRoles = this.getAvailableRolesForPlayer(player);

    // Usar la función mejorada de asignación flexible que tiene en cuenta el rol anterior
    const assignedRole = assignFlexibleRole(
      isTeamA ? this.teamA : this.teamB,
      availableRoles,
      player,
      previousRole
    );

    const assignedPlayer: AssignedPlayer = {
      ...player,
      assignedRole,
      positionForced: isForced,
    };

    if (isTeamA) {
      this.teamA.push(assignedPlayer);
    } else {
      this.teamB.push(assignedPlayer);
    }

    this.assignedPlayerIds.add(player.id);
  }

  private getAvailableRolesForPlayer(player: Member): PlayerRoleType[] {
    if (!player.playerRoles || player.playerRoles.length === 0) {
      return [TYPED_ROLES.WILDCARD];
    }

    // Convertir PlayerRole[] a PlayerRoleType[]
    return player.playerRoles.map((role) =>
      typeof role === 'string' ? (role as PlayerRoleType) : role.role
    );
  }

  private getAllAvailablePlayers(
    playersByPosition: Record<
      PlayerRoleType,
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

  private getPositionCount(
    team: AssignedPlayer[]
  ): Record<PlayerRoleType, number> {
    const counts: Record<PlayerRoleType, number> = {
      Arquero: 0,
      Defensor: 0,
      Mediocampo: 0,
      Delantero: 0,
      Comodín: 0,
    };

    team.forEach((player) => {
      if (player.assignedRole) {
        counts[player.assignedRole]++;
      }
    });

    return counts;
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

  private assignAllRemainingPlayers(members: Member[]): void {
    console.log(
      '\n🔄 Fase adicional: Asignando TODOS los jugadores restantes...'
    );

    const unassignedPlayers = members.filter(
      (member) => !this.assignedPlayerIds.has(member.id)
    );

    if (unassignedPlayers.length === 0) {
      console.log('✅ Todos los jugadores ya fueron asignados');
      return;
    }

    console.log(
      `🎯 Asignando ${unassignedPlayers.length} jugadores restantes...`
    );

    // Ordenar por criterios de balance
    const sortedPlayers = this.sortPlayersByBalanceCriteria(unassignedPlayers);

    // Distribuir jugadores para mantener diferencia máxima de 1
    sortedPlayers.forEach((player) => {
      // Calcular diferencia actual entre equipos
      const teamDiff = this.teamA.length - this.teamB.length;

      // Determinar a qué equipo asignar basado en la diferencia
      let isTeamA;
      if (teamDiff > 0) {
        // Si A tiene más jugadores, forzar B
        isTeamA = false;
      } else if (teamDiff < -1) {
        // Si B tiene más de 1 jugador extra, forzar A
        isTeamA = true;
      } else {
        // Si la diferencia es 0 o -1, usar lógica normal
        isTeamA = this.shouldAssignToTeamA();
      }

      // Determinar la mejor posición para este jugador en el equipo seleccionado
      const bestPosition = this.determineBestPositionForPlayer(player, isTeamA);

      // Solo marcar como forzado si NO tiene esta posición entre sus preferencias
      const isForced = !this.hasRole(player, bestPosition);

      this.assignPlayerToTeam(player, bestPosition, isTeamA, isForced);

      console.log(
        `   ✅ ${player.name} → Equipo ${
          isTeamA ? 'A' : 'B'
        } como ${bestPosition}${isForced ? ' (FORZADO)' : ''}`
      );
    });

    console.log(
      `✅ Todos los ${unassignedPlayers.length} jugadores restantes asignados`
    );

    // Verificación final de balance
    const finalDiff = Math.abs(this.teamA.length - this.teamB.length);
    console.log(
      `📊 Balance final: Equipo A=${this.teamA.length}, Equipo B=${this.teamB.length} (Diferencia: ${finalDiff})`
    );
    if (finalDiff > 1) {
      console.warn(
        `⚠️ Advertencia: Diferencia de ${finalDiff} jugadores entre equipos`
      );
    }
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
      `   Equipo A: GK=${teamACount['Arquero']}, DEF=${teamACount['Defensor']}, MID=${teamACount['Mediocampo']}, FWD=${teamACount['Delantero']}`
    );
    console.log(
      `   Equipo B: GK=${teamBCount['Arquero']}, DEF=${teamBCount['Defensor']}, MID=${teamBCount['Mediocampo']}, FWD=${teamBCount['Delantero']}`
    );

    // Verificación de emergencia para arqueros
    if (teamACount['Arquero'] === 0) {
      console.log('🚨 EMERGENCIA: Equipo A sin arquero - Convirtiendo jugador');
      this.convertPlayerToGoalkeeper(true);
    }

    if (teamBCount['Arquero'] === 0) {
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
      return secondaryRole === TYPED_ROLES.GOALKEEPER;
    });

    // Si no hay nadie con arquero secundario, tomar cualquiera
    if (!targetPlayer) {
      targetPlayer = team[0];
    }

    // Convertir el jugador a arquero
    targetPlayer.assignedRole = TYPED_ROLES.GOALKEEPER;
    // CORREGIDO: Solo marcar como forzado si NO tiene arquero entre sus roles
    targetPlayer.positionForced = !this.hasRole(
      targetPlayer,
      TYPED_ROLES.GOALKEEPER
    );

    console.log(
      `   ✅ ${targetPlayer.name} convertido a arquero en equipo ${
        isTeamA ? 'A' : 'B'
      } ${targetPlayer.positionForced ? '(FORZADO)' : '(SECUNDARIO)'}`
    );
  }

  private balanceTeams(): void {
    const diff = this.teamA.length - this.teamB.length;
    if (Math.abs(diff) <= 1) return; // Ya está balanceado

    const sourceTeam = diff > 0 ? this.teamA : this.teamB;
    const targetTeam = diff > 0 ? this.teamB : this.teamA;
    const playersToMove = Math.floor(Math.abs(diff) / 2);

    console.log(`\n🔄 Balanceando equipos (diferencia: ${Math.abs(diff)})`);
    console.log(
      `   Moviendo ${playersToMove} jugadores de Equipo ${
        diff > 0 ? 'A' : 'B'
      } a Equipo ${diff > 0 ? 'B' : 'A'}`
    );

    for (let i = 0; i < playersToMove; i++) {
      // Buscar el jugador más adecuado para mover (priorizar comodines y roles duplicados)
      const playerToMove = sourceTeam
        .filter((p) => p.assignedRole !== TYPED_ROLES.GOALKEEPER) // No mover arqueros
        .sort((a, b) => {
          // Priorizar comodines
          if (
            a.assignedRole === TYPED_ROLES.WILDCARD &&
            b.assignedRole !== TYPED_ROLES.WILDCARD
          )
            return -1;
          if (
            b.assignedRole === TYPED_ROLES.WILDCARD &&
            a.assignedRole !== TYPED_ROLES.WILDCARD
          )
            return 1;

          // Luego priorizar roles que tengan más jugadores en el equipo origen
          const aCount = sourceTeam.filter(
            (p) => p.assignedRole === a.assignedRole
          ).length;
          const bCount = sourceTeam.filter(
            (p) => p.assignedRole === b.assignedRole
          ).length;
          return bCount - aCount;
        })[0];

      if (playerToMove) {
        // Remover del equipo origen
        const sourceIndex = sourceTeam.findIndex(
          (p) => p.id === playerToMove.id
        );
        sourceTeam.splice(sourceIndex, 1);

        // Agregar al equipo destino
        targetTeam.push(playerToMove);

        console.log(
          `   ✅ Movido: ${playerToMove.name} (${playerToMove.assignedRole})`
        );
      }
    }

    console.log(
      `   📊 Balance final: A=${this.teamA.length}, B=${this.teamB.length}`
    );
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

// Nuevo algoritmo estructurado según los requerimientos del usuario
export const createStructuredBalancedTeams = (
  members: Member[],
  options: BalanceOptions = {},
  previousTeams?: { teamA: string[]; teamB: string[] }
): [AssignedPlayer[], AssignedPlayer[]] => {
  console.log('\n🏗️ ===== ALGORITMO ESTRUCTURADO CON VARIABILIDAD =====');
  console.log(`📊 Total de jugadores: ${members.length}`);
  console.log(
    `⚙️ Opciones: edad=${options.balanceByAge}, rating=${options.balanceByRating}, posición=${options.balanceByRole}, variabilidad=${options.addVariability}`
  );

  // Si no hay variabilidad o no hay equipos previos, ejecutar una sola vez
  if (!options.addVariability || !previousTeams) {
    return executeStructuredBalancing(members, options);
  }

  // === SISTEMA DE VARIABILIDAD ===
  console.log('\n🎲 Iniciando sistema de variabilidad (máximo 100 intentos)');

  const maxTries = 100;
  let tries = 0;
  let foundDifferent = false;
  let bestResult: [AssignedPlayer[], AssignedPlayer[]] | null = null;

  // Normalizar equipos previos para comparación
  const previousTeamAIds = previousTeams.teamA.sort();
  const previousTeamBIds = previousTeams.teamB.sort();

  console.log(
    `🔍 Equipos previos para comparar: A=[${previousTeamAIds.length}], B=[${previousTeamBIds.length}]`
  );

  while (tries < maxTries && !foundDifferent) {
    tries++;

    // Ejecutar el algoritmo estructurado
    const [teamA, teamB] = executeStructuredBalancing(members, options);

    // Extraer IDs de los equipos generados
    const currentTeamAIds = teamA.map((p) => p.id).sort();
    const currentTeamBIds = teamB.map((p) => p.id).sort();

    // Comparar con equipos previos (considerar ambas combinaciones A-B y B-A)
    const sameAsAB =
      JSON.stringify(currentTeamAIds) === JSON.stringify(previousTeamAIds) &&
      JSON.stringify(currentTeamBIds) === JSON.stringify(previousTeamBIds);

    const sameAsBA =
      JSON.stringify(currentTeamAIds) === JSON.stringify(previousTeamBIds) &&
      JSON.stringify(currentTeamBIds) === JSON.stringify(previousTeamAIds);

    if (!sameAsAB && !sameAsBA) {
      foundDifferent = true;
      bestResult = [teamA, teamB];
      console.log(`✅ Encontrada combinación diferente en intento ${tries}`);
    } else {
      console.log(
        `🔄 Intento ${tries}: Equipos iguales a los anteriores, reintentando...`
      );
      bestResult = [teamA, teamB]; // Guardar como respaldo
    }
  }

  if (!foundDifferent) {
    console.log(
      `⚠️ No se encontró combinación diferente después de ${maxTries} intentos`
    );
    console.log(`📝 Devolviendo último resultado generado`);
  }

  return bestResult || executeStructuredBalancing(members, options);
};

// Función auxiliar que ejecuta el algoritmo estructurado una sola vez
function executeStructuredBalancing(
  members: Member[],
  options: BalanceOptions = {}
): [AssignedPlayer[], AssignedPlayer[]] {
  // Inicializar equipos
  let teamA: AssignedPlayer[] = [];
  let teamB: AssignedPlayer[] = [];
  const assignedPlayerIds = new Set<string>();

  // Clasificar jugadores por roles
  const playersByRole = classifyPlayersByRole(members);

  // 1. FASE: Asignar arqueros (1 por equipo)
  console.log('\n🥅 FASE 1: Asignando arqueros (1 por equipo)');
  assignGoalkeepersStructured(
    playersByRole,
    teamA,
    teamB,
    assignedPlayerIds,
    options
  );

  // 2. FASE: Asignar 4 defensores por equipo
  console.log('\n🛡️ FASE 2: Asignando defensores (4 por equipo)');
  assignFieldPlayersStructured(
    TYPED_ROLES.DEFENDER,
    4,
    playersByRole,
    teamA,
    teamB,
    assignedPlayerIds,
    options
  );

  // 3. FASE: Asignar mediocampistas (3 por equipo)
  console.log('\n⚽ FASE 3: Asignando mediocampistas (3 por equipo)');
  assignFieldPlayersStructured(
    TYPED_ROLES.MIDFIELDER,
    3,
    playersByRole,
    teamA,
    teamB,
    assignedPlayerIds,
    options
  );

  // 4. FASE: Asignar delanteros (3 por equipo)
  console.log('\n🎯 FASE 4: Asignando delanteros (3 por equipo)');
  assignFieldPlayersStructured(
    TYPED_ROLES.FORWARD,
    3,
    playersByRole,
    teamA,
    teamB,
    assignedPlayerIds,
    options
  );

  // 5. FASE: Asignar jugadores restantes
  console.log('\n🔄 FASE 5: Asignando jugadores restantes');
  assignRemainingPlayersStructured(
    members,
    teamA,
    teamB,
    assignedPlayerIds,
    options
  );

  // 6. FASE: Balanceo por edad (si está activado)
  if (options.balanceByAge) {
    console.log('\n📅 FASE 6: Balanceo por edad');
    balanceTeamsByAge(teamA, teamB);
  }

  // 7. FASE: Balanceo por habilidad (si está activado)
  if (options.balanceByRating) {
    console.log('\n⭐ FASE 7: Balanceo por habilidad');
    balanceTeamsByRating(teamA, teamB);
  }

  console.log('\n✅ Algoritmo estructurado completado');
  console.log(`   Equipo A: ${teamA.length} jugadores`);
  console.log(`   Equipo B: ${teamB.length} jugadores`);

  return [teamA, teamB];
}

// Funciones auxiliares para el algoritmo estructurado

function classifyPlayersByRole(members: Member[]) {
  const playersByRole: Record<
    PlayerRoleType,
    { primary: Member[]; secondary: Member[]; wildcard: Member[] }
  > = {
    Arquero: { primary: [], secondary: [], wildcard: [] },
    Defensor: { primary: [], secondary: [], wildcard: [] },
    Mediocampo: { primary: [], secondary: [], wildcard: [] },
    Delantero: { primary: [], secondary: [], wildcard: [] },
    Comodín: { primary: [], secondary: [], wildcard: [] },
  };

  members.forEach((member) => {
    const primaryRole = getPrimaryRole(member.playerRoles);
    const secondaryRole = getSecondaryRole(member.playerRoles);

    // Si no tiene roles específicos o es comodín, va a wildcard para todas las posiciones
    if (!primaryRole || primaryRole === TYPED_ROLES.WILDCARD) {
      Object.keys(playersByRole).forEach((position) => {
        playersByRole[position as PlayerRoleType].wildcard.push(member);
      });
      return;
    }

    // Asignar rol primario
    if (playersByRole[primaryRole as PlayerRoleType]) {
      playersByRole[primaryRole as PlayerRoleType].primary.push(member);
    }

    // Asignar rol secundario si existe y no es comodín
    if (
      secondaryRole &&
      secondaryRole !== TYPED_ROLES.WILDCARD &&
      playersByRole[secondaryRole as PlayerRoleType]
    ) {
      playersByRole[secondaryRole as PlayerRoleType].secondary.push(member);
    }
  });

  return playersByRole;
}

function assignGoalkeepersStructured(
  playersByRole: any,
  teamA: AssignedPlayer[],
  teamB: AssignedPlayer[],
  assignedPlayerIds: Set<string>,
  options: BalanceOptions
) {
  const arqueros = playersByRole[TYPED_ROLES.GOALKEEPER];
  const candidates: { player: Member; priority: number; source: string }[] = [];

  // Prioridad 1: Arqueros primarios
  arqueros.primary.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 1, source: 'primario' });
    }
  });

  // Prioridad 2: Arqueros secundarios
  arqueros.secondary.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 2, source: 'secundario' });
    }
  });

  // Prioridad 3: Comodines
  arqueros.wildcard.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 3, source: 'comodín' });
    }
  });

  // Prioridad 4: Forzar al azar si no hay suficientes
  if (candidates.length < 2) {
    console.log('⚠️ No hay suficientes arqueros, forzando asignación al azar');
    Object.values(playersByRole).forEach((positionData: any) => {
      [
        ...positionData.primary,
        ...positionData.secondary,
        ...positionData.wildcard,
      ].forEach((player: Member) => {
        if (
          !assignedPlayerIds.has(player.id) &&
          !candidates.find((c) => c.player.id === player.id)
        ) {
          candidates.push({ player, priority: 4, source: 'forzado' });
        }
      });
    });
  }

  // Sortear candidatos según criterios de balance
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    // Aplicar criterios de desempate si están activados
    if (
      options.balanceByRating &&
      a.player.starRating !== b.player.starRating
    ) {
      return (b.player.starRating || 0) - (a.player.starRating || 0);
    }

    if (options.balanceByAge && a.player.age !== b.player.age) {
      return (b.player.age || 0) - (a.player.age || 0);
    }

    return Math.random() - 0.5; // Aleatorio para variabilidad
  });

  // Asignar arqueros (1 por equipo)
  for (let i = 0; i < Math.min(2, candidates.length); i++) {
    const candidate = candidates[i];
    const isTeamA = i % 2 === 0;
    const isForced = candidate.priority === 4;

    const assignedPlayer: AssignedPlayer = {
      ...candidate.player,
      assignedRole: TYPED_ROLES.GOALKEEPER,
      positionForced: isForced,
    };

    if (isTeamA) {
      teamA.push(assignedPlayer);
    } else {
      teamB.push(assignedPlayer);
    }

    assignedPlayerIds.add(candidate.player.id);

    console.log(
      `   ✅ ${candidate.player.name} → Equipo ${isTeamA ? 'A' : 'B'} (${
        candidate.source
      }${isForced ? ' - FORZADO' : ''})`
    );
  }
}

function assignFieldPlayersStructured(
  position: PlayerRoleType,
  countPerTeam: number,
  playersByRole: any,
  teamA: AssignedPlayer[],
  teamB: AssignedPlayer[],
  assignedPlayerIds: Set<string>,
  options: BalanceOptions
) {
  const positionData = playersByRole[position];
  const candidates: { player: Member; priority: number; source: string }[] = [];

  // Prioridad 1: Jugadores con el rol como primario
  positionData.primary.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 1, source: 'primario' });
    }
  });

  // Prioridad 2: Jugadores con el rol como secundario
  positionData.secondary.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 2, source: 'secundario' });
    }
  });

  // Prioridad 3: Comodines
  positionData.wildcard.forEach((player: Member) => {
    if (!assignedPlayerIds.has(player.id)) {
      candidates.push({ player, priority: 3, source: 'comodín' });
    }
  });

  // Prioridad 4: Forzar de otras posiciones si no hay suficientes
  const needed = countPerTeam * 2;
  if (candidates.length < needed) {
    console.log(
      `⚠️ Faltan jugadores para ${position}, forzando de otras posiciones`
    );
    Object.values(playersByRole).forEach((otherPositionData: any) => {
      [
        ...otherPositionData.primary,
        ...otherPositionData.secondary,
        ...otherPositionData.wildcard,
      ].forEach((player: Member) => {
        if (
          !assignedPlayerIds.has(player.id) &&
          !candidates.find((c) => c.player.id === player.id)
        ) {
          candidates.push({ player, priority: 4, source: 'forzado' });
        }
      });
    });
  }

  // Sortear candidatos
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    if (
      options.balanceByRating &&
      a.player.starRating !== b.player.starRating
    ) {
      return (b.player.starRating || 0) - (a.player.starRating || 0);
    }

    if (options.balanceByAge && a.player.age !== b.player.age) {
      return (b.player.age || 0) - (a.player.age || 0);
    }

    return Math.random() - 0.5;
  });

  // Asignar jugadores alternando equipos
  for (let i = 0; i < Math.min(needed, candidates.length); i++) {
    const candidate = candidates[i];
    const isTeamA = i % 2 === 0;
    const isForced = candidate.priority === 4;

    const assignedPlayer: AssignedPlayer = {
      ...candidate.player,
      assignedRole: position,
      positionForced: isForced,
    };

    if (isTeamA) {
      teamA.push(assignedPlayer);
    } else {
      teamB.push(assignedPlayer);
    }

    assignedPlayerIds.add(candidate.player.id);

    console.log(
      `   ✅ ${candidate.player.name} → Equipo ${isTeamA ? 'A' : 'B'} (${
        candidate.source
      }${isForced ? ' - FORZADO' : ''})`
    );
  }
}

function assignRemainingPlayersStructured(
  members: Member[],
  teamA: AssignedPlayer[],
  teamB: AssignedPlayer[],
  assignedPlayerIds: Set<string>,
  options: BalanceOptions
) {
  const remainingPlayers = members.filter(
    (player) => !assignedPlayerIds.has(player.id)
  );

  if (remainingPlayers.length === 0) {
    console.log('   ✅ No hay jugadores restantes por asignar');
    return;
  }

  console.log(
    `   📊 ${remainingPlayers.length} jugadores restantes por asignar`
  );

  remainingPlayers.forEach((player, index) => {
    const isTeamA = index % 2 === 0;

    // Intentar intercambiar con defensores o mediocampistas si es posible
    let finalPosition = determineBestPositionForRemainingPlayer(
      player,
      isTeamA ? teamA : teamB
    );

    const assignedPlayer: AssignedPlayer = {
      ...player,
      assignedRole: finalPosition,
      positionForced: !hasPlayerRole(player, finalPosition),
    };

    if (isTeamA) {
      teamA.push(assignedPlayer);
    } else {
      teamB.push(assignedPlayer);
    }

    assignedPlayerIds.add(player.id);

    console.log(
      `   ✅ ${player.name} → Equipo ${
        isTeamA ? 'A' : 'B'
      } como ${finalPosition} ${
        assignedPlayer.positionForced ? '(FORZADO)' : ''
      }`
    );
  });
}

function determineBestPositionForRemainingPlayer(
  player: Member,
  team: AssignedPlayer[]
): PlayerRoleType {
  const playerPrimaryRole = getPrimaryRole(player.playerRoles);
  const playerSecondaryRole = getSecondaryRole(player.playerRoles);

  // Si el jugador tiene roles definidos, intentar usarlos
  if (playerPrimaryRole && playerPrimaryRole !== TYPED_ROLES.WILDCARD) {
    return playerPrimaryRole;
  }

  if (playerSecondaryRole && playerSecondaryRole !== TYPED_ROLES.WILDCARD) {
    return playerSecondaryRole;
  }

  // Contar posiciones actuales en el equipo
  const positionCounts = {
    [TYPED_ROLES.DEFENDER]: team.filter(
      (p) => p.assignedRole === TYPED_ROLES.DEFENDER
    ).length,
    [TYPED_ROLES.MIDFIELDER]: team.filter(
      (p) => p.assignedRole === TYPED_ROLES.MIDFIELDER
    ).length,
    [TYPED_ROLES.FORWARD]: team.filter(
      (p) => p.assignedRole === TYPED_ROLES.FORWARD
    ).length,
  };

  // Asignar a la posición con menos jugadores, priorizando delantero si hay empate
  if (positionCounts[TYPED_ROLES.DEFENDER] < 4) {
    return TYPED_ROLES.DEFENDER;
  } else if (positionCounts[TYPED_ROLES.MIDFIELDER] < 3) {
    return TYPED_ROLES.MIDFIELDER;
  } else {
    return TYPED_ROLES.FORWARD; // Por defecto, delantero
  }
}

function hasPlayerRole(player: Member, role: PlayerRoleType): boolean {
  if (!player.playerRoles || player.playerRoles.length === 0) return false;

  // Si es un array de strings
  if (typeof player.playerRoles[0] === 'string') {
    return (player.playerRoles as unknown as PlayerRoleType[]).includes(role);
  }

  // Si es un array de objetos PlayerRole
  return (player.playerRoles as any[]).some((r: any) => r.role === role);
}

function balanceTeamsByAge(teamA: AssignedPlayer[], teamB: AssignedPlayer[]) {
  const avgAgeA =
    teamA.reduce((sum, p) => sum + (p.age || 25), 0) / teamA.length;
  const avgAgeB =
    teamB.reduce((sum, p) => sum + (p.age || 25), 0) / teamB.length;

  console.log(
    `   📊 Edad promedio inicial: A=${avgAgeA.toFixed(1)}, B=${avgAgeB.toFixed(
      1
    )}`
  );

  const ageDifference = Math.abs(avgAgeA - avgAgeB);

  if (ageDifference <= 1) {
    console.log('   ✅ Balance de edad ya es aceptable');
    return;
  }

  // Intercambiar jugadores posición por posición para mejorar balance
  const positions = [
    TYPED_ROLES.DEFENDER,
    TYPED_ROLES.MIDFIELDER,
    TYPED_ROLES.FORWARD,
  ];

  // Mezclar posiciones aleatoriamente para preservar variabilidad
  const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

  for (const position of shuffledPositions) {
    const playersA = teamA.filter((p) => p.assignedRole === position);
    const playersB = teamB.filter((p) => p.assignedRole === position);

    // Mezclar jugadores aleatoriamente para preservar variabilidad
    const shuffledPlayersA = [...playersA].sort(() => Math.random() - 0.5);
    const shuffledPlayersB = [...playersB].sort(() => Math.random() - 0.5);

    // Buscar intercambios válidos (no necesariamente el mejor)
    const validSwaps = [];

    for (let i = 0; i < shuffledPlayersA.length; i++) {
      for (let j = 0; j < shuffledPlayersB.length; j++) {
        const playerA = shuffledPlayersA[i];
        const playerB = shuffledPlayersB[j];

        // Calcular mejora potencial
        const currentDiff = Math.abs(avgAgeA - avgAgeB);
        const newAvgA =
          (avgAgeA * teamA.length - (playerA.age || 25) + (playerB.age || 25)) /
          teamA.length;
        const newAvgB =
          (avgAgeB * teamB.length - (playerB.age || 25) + (playerA.age || 25)) /
          teamB.length;
        const newDiff = Math.abs(newAvgA - newAvgB);

        // Aceptar cualquier intercambio que mejore el balance
        if (newDiff < currentDiff) {
          validSwaps.push({
            playerA,
            playerB,
            improvement: currentDiff - newDiff,
          });
        }
      }
    }

    // Si hay intercambios válidos, elegir uno aleatoriamente
    if (validSwaps.length > 0) {
      // Ordenar por mejora y tomar uno de los mejores (con aleatoriedad)
      validSwaps.sort((a, b) => b.improvement - a.improvement);

      // Tomar uno de los mejores intercambios (no necesariamente el mejor)
      const maxIndex = Math.min(3, validSwaps.length - 1); // Considerar hasta 3 mejores opciones
      const selectedSwap =
        validSwaps[Math.floor(Math.random() * (maxIndex + 1))];

      // Realizar intercambio
      const indexA = teamA.indexOf(selectedSwap.playerA);
      const indexB = teamB.indexOf(selectedSwap.playerB);

      teamA[indexA] = selectedSwap.playerB;
      teamB[indexB] = selectedSwap.playerA;

      console.log(
        `   🔄 Intercambio por edad: ${selectedSwap.playerA.name} ↔ ${
          selectedSwap.playerB.name
        } (${position}) - Mejora: ${selectedSwap.improvement.toFixed(2)}`
      );

      // Continuar con el balanceo pero limitar recursión para evitar loops infinitos
      const newAvgAgeA =
        teamA.reduce((sum, p) => sum + (p.age || 25), 0) / teamA.length;
      const newAvgAgeB =
        teamB.reduce((sum, p) => sum + (p.age || 25), 0) / teamB.length;
      const newAgeDifference = Math.abs(newAvgAgeA - newAvgAgeB);

      if (newAgeDifference > 1 && newAgeDifference < ageDifference) {
        // Solo continuar si hay mejora y no estamos en un loop
        return balanceTeamsByAge(teamA, teamB);
      }

      return; // Salir después de un intercambio para preservar variabilidad
    }
  }
}

function balanceTeamsByRating(
  teamA: AssignedPlayer[],
  teamB: AssignedPlayer[]
) {
  const avgRatingA =
    teamA.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamA.length;
  const avgRatingB =
    teamB.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamB.length;

  console.log(
    `   📊 Rating promedio inicial: A=${avgRatingA.toFixed(
      1
    )}, B=${avgRatingB.toFixed(1)}`
  );

  const ratingDifference = Math.abs(avgRatingA - avgRatingB);

  if (ratingDifference <= 0.2) {
    console.log('   ✅ Balance de habilidad ya es aceptable');
    return;
  }

  // Intercambiar jugadores posición por posición para mejorar balance
  const positions = [
    TYPED_ROLES.DEFENDER,
    TYPED_ROLES.MIDFIELDER,
    TYPED_ROLES.FORWARD,
  ];

  // Mezclar posiciones aleatoriamente para preservar variabilidad
  const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

  for (const position of shuffledPositions) {
    const playersA = teamA.filter((p) => p.assignedRole === position);
    const playersB = teamB.filter((p) => p.assignedRole === position);

    // Mezclar jugadores aleatoriamente para preservar variabilidad
    const shuffledPlayersA = [...playersA].sort(() => Math.random() - 0.5);
    const shuffledPlayersB = [...playersB].sort(() => Math.random() - 0.5);

    // Buscar intercambios válidos (no necesariamente el mejor)
    const validSwaps = [];

    for (let i = 0; i < shuffledPlayersA.length; i++) {
      for (let j = 0; j < shuffledPlayersB.length; j++) {
        const playerA = shuffledPlayersA[i];
        const playerB = shuffledPlayersB[j];

        // Calcular mejora potencial
        const currentDiff = Math.abs(avgRatingA - avgRatingB);
        const newAvgA =
          (avgRatingA * teamA.length -
            (playerA.starRating || 3) +
            (playerB.starRating || 3)) /
          teamA.length;
        const newAvgB =
          (avgRatingB * teamB.length -
            (playerB.starRating || 3) +
            (playerA.starRating || 3)) /
          teamB.length;
        const newDiff = Math.abs(newAvgA - newAvgB);

        // Aceptar cualquier intercambio que mejore el balance
        if (newDiff < currentDiff) {
          validSwaps.push({
            playerA,
            playerB,
            improvement: currentDiff - newDiff,
          });
        }
      }
    }

    // Si hay intercambios válidos, elegir uno aleatoriamente
    if (validSwaps.length > 0) {
      // Ordenar por mejora y tomar uno de los mejores (con aleatoriedad)
      validSwaps.sort((a, b) => b.improvement - a.improvement);

      // Tomar uno de los mejores intercambios (no necesariamente el mejor)
      const maxIndex = Math.min(3, validSwaps.length - 1); // Considerar hasta 3 mejores opciones
      const selectedSwap =
        validSwaps[Math.floor(Math.random() * (maxIndex + 1))];

      // Realizar intercambio
      const indexA = teamA.indexOf(selectedSwap.playerA);
      const indexB = teamB.indexOf(selectedSwap.playerB);

      teamA[indexA] = selectedSwap.playerB;
      teamB[indexB] = selectedSwap.playerA;

      console.log(
        `   🔄 Intercambio por habilidad: ${selectedSwap.playerA.name} ↔ ${
          selectedSwap.playerB.name
        } (${position}) - Mejora: ${selectedSwap.improvement.toFixed(2)}`
      );

      // Continuar con el balanceo pero limitar recursión para evitar loops infinitos
      const newAvgRatingA =
        teamA.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamA.length;
      const newAvgRatingB =
        teamB.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamB.length;
      const newRatingDifference = Math.abs(newAvgRatingA - newAvgRatingB);

      if (newRatingDifference > 0.2 && newRatingDifference < ratingDifference) {
        // Solo continuar si hay mejora y no estamos en un loop
        return balanceTeamsByRating(teamA, teamB);
      }

      return; // Salir después de un intercambio para preservar variabilidad
    }
  }
}
