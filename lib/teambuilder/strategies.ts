import { Member, BalanceStrategy } from './types';
import {
  PLAYER_ROLES,
  ROLE_PRIORITY,
  FORMATION,
  MINIMUM_FORMATIONS,
  getPrimaryRole,
  POSITION_ASSIGNMENT_PATTERN,
} from './constants';

// Estrategia para equilibrar por roles
export class RoleBalanceStrategy implements BalanceStrategy {
  name = 'RoleBalance';

  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    playersByRole?: Record<string, Member[]>,
    playersWithoutRole?: Member[]
  ): void {
    // Si no se proporcionan las clasificaciones, crearlas
    if (!playersByRole || !playersWithoutRole) {
      const result = this.classifyPlayersByRole(players);
      playersByRole = result.playersByRole;
      playersWithoutRole = result.playersWithoutRole;
    }

    // Primero asignar arqueros (máximo 1 por equipo)
    this.assignGoalkeepers(playersByRole, teamA, teamB);

    // Asignar el resto de posiciones siguiendo el patrón requerido
    this.assignPositionsByPattern(
      playersByRole,
      playersWithoutRole,
      teamA,
      teamB
    );

    // Verificar y corregir desbalances posicionales
    this.balancePositionalDistribution(teamA);
    this.balancePositionalDistribution(teamB);
  }

  // Método para clasificar jugadores por rol
  private classifyPlayersByRole(players: Member[]): {
    playersByRole: Record<string, Member[]>;
    playersWithoutRole: Member[];
  } {
    const playersByRole: Record<string, Member[]> = {};
    const playersWithoutRole: Member[] = [];

    players.forEach((player) => {
      const primaryRole = getPrimaryRole(player.playerRoles);
      if (primaryRole) {
        if (!playersByRole[primaryRole]) {
          playersByRole[primaryRole] = [];
        }
        playersByRole[primaryRole].push(player);
      } else {
        playersWithoutRole.push(player);
      }
    });

    return { playersByRole, playersWithoutRole };
  }

  // Método específico para asignar arqueros (máximo 1 por equipo)
  private assignGoalkeepers(
    playersByRole: Record<string, Member[]>,
    teamA: Member[],
    teamB: Member[]
  ): void {
    const goalkeepers = playersByRole[PLAYER_ROLES.GOALKEEPER] || [];

    if (goalkeepers.length >= 2) {
      // Si hay 2 o más arqueros, asignar uno a cada equipo
      teamA.push({
        ...goalkeepers.shift()!,
        assignedRole: PLAYER_ROLES.GOALKEEPER,
      });
      teamB.push({
        ...goalkeepers.shift()!,
        assignedRole: PLAYER_ROLES.GOALKEEPER,
      });
    } else if (goalkeepers.length === 1) {
      // Si solo hay un arquero, asignarlo al equipo más débil o aleatoriamente
      if (Math.random() > 0.5) {
        teamA.push({
          ...goalkeepers.shift()!,
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
      } else {
        teamB.push({
          ...goalkeepers.shift()!,
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
      }
    } else {
      // Si no hay arqueros, usar comodines
      const wildcards = playersByRole[PLAYER_ROLES.WILDCARD] || [];

      if (wildcards.length >= 2) {
        teamA.push({
          ...wildcards.shift()!,
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        teamB.push({
          ...wildcards.shift()!,
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
      } else if (wildcards.length === 1) {
        // Asignar el único comodín a un equipo y buscar otro jugador para el otro
        if (Math.random() > 0.5) {
          teamA.push({
            ...wildcards.shift()!,
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          // Buscar para B en otros roles
          this.findAndAssignReplacementKeeper(playersByRole, teamB);
        } else {
          teamB.push({
            ...wildcards.shift()!,
            assignedRole: PLAYER_ROLES.GOALKEEPER,
          });
          // Buscar para A en otros roles
          this.findAndAssignReplacementKeeper(playersByRole, teamA);
        }
      } else {
        // No hay arqueros ni comodines, buscar en otras posiciones
        this.findAndAssignReplacementKeeper(playersByRole, teamA);
        this.findAndAssignReplacementKeeper(playersByRole, teamB);
      }
    }
  }

  // Buscar y asignar un reemplazo para arquero
  private findAndAssignReplacementKeeper(
    playersByRole: Record<string, Member[]>,
    team: Member[]
  ): void {
    // NUEVO: Primero buscar jugadores que tengan arquero como rol secundario
    const findPlayerWithSecondaryGoalkeeperRole = (): Member | null => {
      const allPositions = [
        PLAYER_ROLES.MIDFIELDER,
        PLAYER_ROLES.DEFENDER,
        PLAYER_ROLES.FORWARD,
        PLAYER_ROLES.WILDCARD,
      ];

      for (const position of allPositions) {
        const playersInPosition = playersByRole[position] || [];
        for (let i = 0; i < playersInPosition.length; i++) {
          const player = playersInPosition[i];

          // Verificar si el jugador tiene arquero en sus roles (cualquier prioridad)
          const hasGoalkeeperRole = player.playerRoles?.some((role) => {
            if (typeof role === 'string') {
              return role === PLAYER_ROLES.GOALKEEPER;
            } else if (role && typeof role === 'object' && 'role' in role) {
              return role.role === PLAYER_ROLES.GOALKEEPER;
            }
            return false;
          });

          if (hasGoalkeeperRole) {
            console.log(
              `🥅 Encontrado jugador con rol secundario de arquero: ${player.name} (rol principal: ${position})`
            );
            // Remover el jugador de su posición original
            playersByRole[position].splice(i, 1);
            return player;
          }
        }
      }
      return null;
    };

    // Intentar encontrar un jugador con rol secundario de arquero
    const playerWithGoalkeeperRole = findPlayerWithSecondaryGoalkeeperRole();
    if (playerWithGoalkeeperRole) {
      team.push({
        ...playerWithGoalkeeperRole,
        assignedRole: PLAYER_ROLES.GOALKEEPER,
      });
      return;
    }

    // Si no hay jugadores con rol secundario de arquero, buscar en otras posiciones (lógica original)
    const positionOrder = [
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.FORWARD,
    ];

    for (const position of positionOrder) {
      if (playersByRole[position] && playersByRole[position].length > 0) {
        console.log(
          `🥅 Asignando jugador de ${position} como arquero por necesidad`
        );
        team.push({
          ...playersByRole[position].shift()!,
          assignedRole: PLAYER_ROLES.GOALKEEPER,
        });
        return;
      }
    }

    // Si no encontramos reemplazo, crear uno ficticio (último recurso)
    console.log(
      'No se encontró reemplazo para arquero, se creará uno ficticio'
    );
  }

  // Método para asignar posiciones siguiendo el patrón requerido y garantizar distribución equilibrada
  private assignPositionsByPattern(
    playersByRole: Record<string, Member[]>,
    playersWithoutRole: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    let currentTeam = teamA; // Empezar con equipo A
    let patternIndex = 0;

    // Calcular el número total de jugadores disponibles
    const totalRealPlayers =
      Object.values(playersByRole).reduce(
        (sum, players) => sum + players.length,
        0
      ) + playersWithoutRole.length;

    // Calcular jugadores por equipo (aproximadamente)
    const approxPlayersPerTeam = Math.ceil(totalRealPlayers / 2);

    // Determinar si estamos en un escenario de equipo pequeño (menos de 7 jugadores por equipo)
    const isSmallTeam = approxPlayersPerTeam <= 7;

    // Para equipos pequeños, garantizar al menos un jugador por posición clave
    if (isSmallTeam) {
      console.log('Aplicando distribución garantizada para equipos pequeños');
      this.guaranteeKeyPositions(
        playersByRole,
        playersWithoutRole,
        teamA,
        teamB
      );
      return;
    }

    // Para equipos normales, garantizar formaciones mínimas 4-3-3 o 4-4-2
    this.guaranteeMinimumFormation(
      playersByRole,
      playersWithoutRole,
      teamA,
      teamB
    );

    // Distribuir jugadores restantes de manera equilibrada
    this.distributeRemainingPlayers(
      playersByRole,
      playersWithoutRole,
      teamA,
      teamB
    );
  }

  // Método específico para garantizar posiciones clave en equipos pequeños
  private guaranteeKeyPositions(
    playersByRole: Record<string, Member[]>,
    playersWithoutRole: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    // Definir las posiciones clave que queremos garantizar
    const keyPositions = [
      PLAYER_ROLES.GOALKEEPER,
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
    ];

    // Función auxiliar para asignar una posición clave
    const assignKeyPosition = (team: Member[], position: string): boolean => {
      // Verificar si el equipo ya tiene un jugador en esta posición
      const hasPosition = team.some((p) => p.assignedRole === position);
      if (hasPosition) return true;

      // Buscar un jugador para esta posición
      let player: Member | undefined;

      // Primero intentar con jugadores de esa posición
      if (playersByRole[position] && playersByRole[position].length > 0) {
        player = playersByRole[position].shift();
      }
      // Luego intentar con comodines
      else if (
        playersByRole[PLAYER_ROLES.WILDCARD] &&
        playersByRole[PLAYER_ROLES.WILDCARD].length > 0
      ) {
        player = playersByRole[PLAYER_ROLES.WILDCARD].shift();
      }
      // Finalmente intentar con jugadores sin rol
      else if (playersWithoutRole.length > 0) {
        player = playersWithoutRole.shift();
      }
      // Si no hay ninguna opción, buscar en otras posiciones con exceso
      else {
        // Buscar la posición con más jugadores disponibles
        let maxPosition = '';
        let maxCount = 0;

        for (const pos in playersByRole) {
          if (
            playersByRole[pos].length > maxCount &&
            pos !== PLAYER_ROLES.GOALKEEPER
          ) {
            maxCount = playersByRole[pos].length;
            maxPosition = pos;
          }
        }

        if (maxCount > 0) {
          player = playersByRole[maxPosition].shift();
        }
      }

      // Si encontramos un jugador, asignarlo a esta posición
      if (player) {
        team.push({ ...player, assignedRole: position });
        return true;
      }

      return false;
    };

    // Asignar primero las posiciones clave para el equipo A
    for (const position of keyPositions) {
      // Los arqueros ya fueron asignados, verificar si ya tiene uno
      if (
        position === PLAYER_ROLES.GOALKEEPER &&
        teamA.some((p) => p.assignedRole === position)
      ) {
        continue;
      }
      assignKeyPosition(teamA, position);
    }

    // Asignar las posiciones clave para el equipo B
    for (const position of keyPositions) {
      // Los arqueros ya fueron asignados, verificar si ya tiene uno
      if (
        position === PLAYER_ROLES.GOALKEEPER &&
        teamB.some((p) => p.assignedRole === position)
      ) {
        continue;
      }
      assignKeyPosition(teamB, position);
    }

    // Ahora distribuir los jugadores restantes entre ambos equipos
    let currentTeam = teamA;
    let remainingPlayers: Member[] = [];

    // Combinar todos los jugadores restantes
    for (const role in playersByRole) {
      remainingPlayers.push(...playersByRole[role]);
      playersByRole[role] = []; // Vaciar el arreglo original
    }
    remainingPlayers.push(...playersWithoutRole);
    playersWithoutRole.length = 0; // Vaciar el arreglo original

    // Asignar posiciones alternando equipos para el resto de jugadores
    while (remainingPlayers.length > 0) {
      const player = remainingPlayers.shift();
      if (player) {
        // Determinar qué rol asignar (intentar mantener el rol original)
        let assignedRole =
          getPrimaryRole(player.playerRoles) || PLAYER_ROLES.MIDFIELDER;

        // Verificar si el equipo ya tiene suficientes jugadores de este rol
        const roleCount = currentTeam.filter(
          (p) => p.assignedRole === assignedRole
        ).length;
        const maxForRole =
          assignedRole === PLAYER_ROLES.GOALKEEPER
            ? 1
            : assignedRole === PLAYER_ROLES.DEFENDER
            ? 2
            : assignedRole === PLAYER_ROLES.MIDFIELDER
            ? 2
            : 1;

        // Si ya hay suficientes de este rol, asignar otro
        if (roleCount >= maxForRole) {
          // Buscar un rol con menos jugadores
          const roleCounts = {
            [PLAYER_ROLES.GOALKEEPER]: currentTeam.filter(
              (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
            ).length,
            [PLAYER_ROLES.DEFENDER]: currentTeam.filter(
              (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
            ).length,
            [PLAYER_ROLES.MIDFIELDER]: currentTeam.filter(
              (p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER
            ).length,
            [PLAYER_ROLES.FORWARD]: currentTeam.filter(
              (p) => p.assignedRole === PLAYER_ROLES.FORWARD
            ).length,
          };

          // Encontrar el rol con menos jugadores (excluyendo arquero si ya hay uno)
          let minRole = PLAYER_ROLES.MIDFIELDER;
          let minCount = roleCounts[PLAYER_ROLES.MIDFIELDER];

          for (const role in roleCounts) {
            if (role !== PLAYER_ROLES.GOALKEEPER || roleCounts[role] === 0) {
              if (roleCounts[role] < minCount) {
                minCount = roleCounts[role];
                minRole = role;
              }
            }
          }

          assignedRole = minRole;
        }

        currentTeam.push({ ...player, assignedRole });
        currentTeam = currentTeam === teamA ? teamB : teamA;
      }
    }
  }

  // Método para balancear la distribución posicional final
  private balancePositionalDistribution(team: Member[]): void {
    if (team.length <= 2) return; // No aplicar a equipos muy pequeños

    // Contar jugadores por posición
    const positionCounts = {
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

    console.log(
      `Distribución posicional inicial: GK=${
        positionCounts[PLAYER_ROLES.GOALKEEPER]
      }, DEF=${positionCounts[PLAYER_ROLES.DEFENDER]}, MID=${
        positionCounts[PLAYER_ROLES.MIDFIELDER]
      }, FWD=${positionCounts[PLAYER_ROLES.FORWARD]}`
    );

    // Verificar si hay desequilibrios graves
    const totalPlayers = team.length;
    const maxDefenders = Math.max(1, Math.ceil(totalPlayers * 0.4)); // Máximo 40% de defensores
    const minAttackers = Math.max(1, Math.floor(totalPlayers * 0.2)); // Mínimo 20% de delanteros

    // Corregir exceso de defensores si es necesario
    if (positionCounts[PLAYER_ROLES.DEFENDER] > maxDefenders) {
      console.log(
        `Demasiados defensores (${
          positionCounts[PLAYER_ROLES.DEFENDER]
        }/${totalPlayers}), reasignando algunos...`
      );

      const excessDefenders =
        positionCounts[PLAYER_ROLES.DEFENDER] - maxDefenders;
      const defenders = team.filter(
        (p) => p.assignedRole === PLAYER_ROLES.DEFENDER
      );

      // Determinar qué posiciones necesitan refuerzo
      let targetRole = PLAYER_ROLES.FORWARD;
      if (positionCounts[PLAYER_ROLES.FORWARD] < minAttackers) {
        targetRole = PLAYER_ROLES.FORWARD;
      } else if (
        positionCounts[PLAYER_ROLES.MIDFIELDER] <
        positionCounts[PLAYER_ROLES.DEFENDER]
      ) {
        targetRole = PLAYER_ROLES.MIDFIELDER;
      }

      // Reasignar algunos defensores
      for (let i = 0; i < excessDefenders && i < defenders.length; i++) {
        const index = team.findIndex((p) => p.id === defenders[i].id);
        if (index !== -1) {
          team[index].assignedRole = targetRole;
          console.log(`Reasignado defensor a ${targetRole}`);
        }
      }
    }

    // Asegurar al menos un delantero si hay suficientes jugadores
    if (positionCounts[PLAYER_ROLES.FORWARD] < 1 && totalPlayers >= 4) {
      console.log(
        `No hay delanteros en un equipo de ${totalPlayers} jugadores, asignando uno...`
      );

      // Buscar un jugador para reasignar como delantero (prioridad: mediocampistas, luego defensores extra)
      let sourceRole =
        positionCounts[PLAYER_ROLES.MIDFIELDER] > 1
          ? PLAYER_ROLES.MIDFIELDER
          : PLAYER_ROLES.DEFENDER;

      const candidatesForForward = team.filter(
        (p) => p.assignedRole === sourceRole
      );
      if (candidatesForForward.length > 0) {
        // Elegir preferentemente un jugador que tenga el rol de delantero entre sus roles
        const idealCandidate =
          candidatesForForward.find((p) => {
            if (!p.playerRoles) return false;
            return p.playerRoles.some((role) => {
              if (typeof role === 'string') {
                return role === PLAYER_ROLES.FORWARD;
              } else if (role && typeof role === 'object' && 'role' in role) {
                return role.role === PLAYER_ROLES.FORWARD;
              }
              return false;
            });
          }) || candidatesForForward[0];

        const index = team.findIndex((p) => p.id === idealCandidate.id);
        if (index !== -1) {
          team[index].assignedRole = PLAYER_ROLES.FORWARD;
          console.log(`Reasignado ${sourceRole} a ${PLAYER_ROLES.FORWARD}`);
        }
      }
    }

    // Verificar la distribución final
    const finalCounts = {
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

    console.log(
      `Distribución posicional corregida: GK=${
        finalCounts[PLAYER_ROLES.GOALKEEPER]
      }, DEF=${finalCounts[PLAYER_ROLES.DEFENDER]}, MID=${
        finalCounts[PLAYER_ROLES.MIDFIELDER]
      }, FWD=${finalCounts[PLAYER_ROLES.FORWARD]}`
    );
  }

  // Método para garantizar formaciones mínimas (4-3-3 o 4-4-2)
  private guaranteeMinimumFormation(
    playersByRole: Record<string, Member[]>,
    playersWithoutRole: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    console.log('🎯 Garantizando formaciones mínimas 4-3-3 o 4-4-2...');

    // Calcular jugadores totales disponibles
    const totalPlayers =
      Object.values(playersByRole).reduce(
        (sum, players) => sum + players.length,
        0
      ) + playersWithoutRole.length;

    // Cada equipo debe tener al menos 11 jugadores para garantizar formación completa
    const playersPerTeam = Math.floor(totalPlayers / 2);

    if (playersPerTeam < 11) {
      console.log(
        `⚠️ Solo hay ${playersPerTeam} jugadores por equipo, aplicando formación reducida`
      );
      this.guaranteeKeyPositions(
        playersByRole,
        playersWithoutRole,
        teamA,
        teamB
      );
      return;
    }

    // Función para asegurar formación mínima para un equipo
    const ensureMinimumFormation = (
      team: Member[],
      formationType: '4-3-3' | '4-4-2'
    ) => {
      const formation = MINIMUM_FORMATIONS[formationType];
      const needed = {
        [PLAYER_ROLES.GOALKEEPER]: Math.max(
          0,
          formation.GOALKEEPER -
            team.filter((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER)
              .length
        ),
        [PLAYER_ROLES.DEFENDER]: Math.max(
          0,
          formation.DEFENDERS -
            team.filter((p) => p.assignedRole === PLAYER_ROLES.DEFENDER).length
        ),
        [PLAYER_ROLES.MIDFIELDER]: Math.max(
          0,
          formation.MIDFIELDERS -
            team.filter((p) => p.assignedRole === PLAYER_ROLES.MIDFIELDER)
              .length
        ),
        [PLAYER_ROLES.FORWARD]: Math.max(
          0,
          formation.FORWARDS -
            team.filter((p) => p.assignedRole === PLAYER_ROLES.FORWARD).length
        ),
      };

      // Asignar jugadores necesarios por posición
      Object.entries(needed).forEach(([position, count]) => {
        for (let i = 0; i < count; i++) {
          let player: Member | undefined;

          // Buscar jugador en orden de prioridad
          if (playersByRole[position]?.length > 0) {
            player = playersByRole[position].shift();
          } else if (playersByRole[PLAYER_ROLES.WILDCARD]?.length > 0) {
            player = playersByRole[PLAYER_ROLES.WILDCARD].shift();
          } else if (playersWithoutRole.length > 0) {
            player = playersWithoutRole.shift();
          } else {
            // Buscar en otras posiciones
            for (const role of Object.keys(playersByRole)) {
              if (playersByRole[role].length > 0) {
                player = playersByRole[role].shift();
                break;
              }
            }
          }

          if (player) {
            team.push({ ...player, assignedRole: position });
            console.log(`✅ Asignado ${player.name} como ${position}`);
          }
        }
      });
    };

    // Decidir qué formación usar (4-3-3 por defecto, 4-4-2 si hay más mediocampistas)
    const totalMidfielders =
      playersByRole[PLAYER_ROLES.MIDFIELDER]?.length || 0;
    const totalForwards = playersByRole[PLAYER_ROLES.FORWARD]?.length || 0;

    const useFormation442 = totalMidfielders > totalForwards;
    const formation = useFormation442 ? '4-4-2' : '4-3-3';

    console.log(`📋 Usando formación ${formation} para ambos equipos`);

    // Garantizar formación mínima para ambos equipos
    ensureMinimumFormation(teamA, formation);
    ensureMinimumFormation(teamB, formation);

    console.log(`✅ Formación ${formation} garantizada para ambos equipos`);
  }

  // Método para distribuir jugadores restantes después de garantizar formaciones mínimas
  private distributeRemainingPlayers(
    playersByRole: Record<string, Member[]>,
    playersWithoutRole: Member[],
    teamA: Member[],
    teamB: Member[]
  ): void {
    // Combinar todos los jugadores restantes
    const remainingPlayers: Member[] = [];

    // Agregar jugadores restantes de cada posición
    Object.values(playersByRole).forEach((players) => {
      remainingPlayers.push(...players);
    });
    remainingPlayers.push(...playersWithoutRole);

    if (remainingPlayers.length === 0) {
      console.log('✅ No hay jugadores restantes para distribuir');
      return;
    }

    console.log(
      `🔄 Distribuyendo ${remainingPlayers.length} jugadores restantes`
    );

    // Alternar la asignación entre equipos para mantener equilibrio
    let currentTeam = teamA.length <= teamB.length ? teamA : teamB;

    remainingPlayers.forEach((player, index) => {
      // Determinar el rol más apropiado basado en las necesidades del equipo
      const bestRole = this.determineBestRoleForTeam(player, currentTeam);

      // Asignar el jugador al equipo actual
      currentTeam.push({ ...player, assignedRole: bestRole });

      // Alternar al siguiente equipo
      currentTeam = currentTeam === teamA ? teamB : teamA;
    });

    console.log(`✅ Jugadores restantes distribuidos`);
  }

  // Método auxiliar para determinar el mejor rol para un jugador en un equipo específico
  private determineBestRoleForTeam(player: Member, team: Member[]): string {
    // Obtener el rol preferido del jugador
    const preferredRole = getPrimaryRole(player.playerRoles);

    // Contar jugadores actuales por posición en el equipo
    const positionCounts = {
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

    // Si el rol preferido es válido y no hay demasiados jugadores en esa posición, usarlo
    if (preferredRole && preferredRole !== PLAYER_ROLES.WILDCARD) {
      const maxAllowed = this.getMaxAllowedForPosition(preferredRole);
      if (positionCounts[preferredRole] < maxAllowed) {
        return preferredRole;
      }
    }

    // Si no, encontrar la posición que más necesita jugadores
    const positionNeeds = [
      {
        role: PLAYER_ROLES.DEFENDER,
        need:
          this.getMaxAllowedForPosition(PLAYER_ROLES.DEFENDER) -
          positionCounts[PLAYER_ROLES.DEFENDER],
      },
      {
        role: PLAYER_ROLES.MIDFIELDER,
        need:
          this.getMaxAllowedForPosition(PLAYER_ROLES.MIDFIELDER) -
          positionCounts[PLAYER_ROLES.MIDFIELDER],
      },
      {
        role: PLAYER_ROLES.FORWARD,
        need:
          this.getMaxAllowedForPosition(PLAYER_ROLES.FORWARD) -
          positionCounts[PLAYER_ROLES.FORWARD],
      },
    ]
      .filter((p) => p.need > 0)
      .sort((a, b) => b.need - a.need);

    // Devolver la posición que más necesita jugadores, o mediocampo por defecto
    return positionNeeds.length > 0
      ? positionNeeds[0].role
      : PLAYER_ROLES.MIDFIELDER;
  }

  // Método auxiliar para obtener el máximo permitido por posición (más flexible que formación estricta)
  private getMaxAllowedForPosition(position: string): number {
    switch (position) {
      case PLAYER_ROLES.GOALKEEPER:
        return 1; // Solo 1 arquero
      case PLAYER_ROLES.DEFENDER:
        return 6; // Flexible entre 4-6 defensores
      case PLAYER_ROLES.MIDFIELDER:
        return 6; // Flexible entre 3-6 mediocampistas
      case PLAYER_ROLES.FORWARD:
        return 4; // Flexible entre 2-4 delanteros
      default:
        return 2;
    }
  }
}

// Estrategia para equilibrar por edad
export class AgeBalanceStrategy implements BalanceStrategy {
  name = 'AgeBalance';

  applyStrategy(players: Member[], teamA: Member[], teamB: Member[]): void {
    // Primero agrupar jugadores por edad
    const playersByAge: Record<string, Member[]> = {};
    const playersWithoutAge: Member[] = [];

    // Clasificar jugadores por grupos de edad
    players.forEach((member) => {
      if (member.age !== null && member.age !== undefined) {
        const ageKey = member.age.toString();
        if (!playersByAge[ageKey]) {
          playersByAge[ageKey] = [];
        }
        playersByAge[ageKey].push(member);
      } else {
        playersWithoutAge.push(member);
      }
    });

    // Obtener las edades en orden descendente
    const ages = Object.keys(playersByAge)
      .map(Number)
      .sort((a, b) => b - a);

    // Para cada grupo de edad, mezclarlos aleatoriamente y luego distribuirlos
    ages.forEach((age) => {
      // Mezclar el grupo de jugadores de la misma edad
      const shuffledSameAge = [...playersByAge[age.toString()]].sort(
        () => Math.random() - 0.5
      );

      // Distribuir alternadamente
      shuffledSameAge.forEach((member, index) => {
        if (index % 2 === 0) {
          teamA.push(member);
        } else {
          teamB.push(member);
        }
      });
    });

    // Mezclar jugadores sin edad y distribuirlos
    const shuffledWithoutAge = [...playersWithoutAge].sort(
      () => Math.random() - 0.5
    );
    shuffledWithoutAge.forEach((member, index) => {
      if (index % 2 === 0) {
        teamA.push(member);
      } else {
        teamB.push(member);
      }
    });
  }
}

// Estrategia para equilibrar por nivel de habilidad
export class SkillBalanceStrategy implements BalanceStrategy {
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
export class CombinedBalanceStrategy implements BalanceStrategy {
  name = 'CombinedBalance';

  applyStrategy(
    players: Member[],
    teamA: Member[],
    teamB: Member[],
    playersByRole?: Record<string, Member[]>,
    playersWithoutRole?: Member[]
  ): void {
    // Si no se proporcionan las clasificaciones, crearlas
    if (!playersByRole || !playersWithoutRole) {
      const result = this.classifyPlayersByRole(players);
      playersByRole = result.playersByRole;
      playersWithoutRole = result.playersWithoutRole;
    }

    // Función de distribución ponderada para cada posición
    const distributeRoleByMultiCriteria = (
      role: string,
      maxPerTeam: number
    ) => {
      const players = playersByRole![role] || [];

      // Agrupar jugadores por su puntaje combinado (con una precisión de 1 decimal)
      const playersByScore: Record<string, Member[]> = {};

      players.forEach((player) => {
        // Calcular puntuación combinada: 70% rating + 30% edad normalizada
        const score =
          (player.starRating || 3) * 0.7 + ((player.age || 30) / 50) * 0.3;
        const scoreKey = score.toFixed(1);

        if (!playersByScore[scoreKey]) {
          playersByScore[scoreKey] = [];
        }
        playersByScore[scoreKey].push(player);
      });

      // Obtener puntajes en orden descendente
      const scores = Object.keys(playersByScore)
        .map(Number)
        .sort((a, b) => b - a);

      // Preparar arreglos para cada equipo
      const forTeamA: Member[] = [];
      const forTeamB: Member[] = [];

      // Para cada grupo de puntaje, mezclarlos y distribuirlos
      scores.forEach((score) => {
        // Mezclar jugadores con el mismo puntaje
        const shuffledSameScore = [...playersByScore[score.toFixed(1)]].sort(
          () => Math.random() - 0.5
        );

        // Distribuir alternadamente hasta alcanzar el máximo por equipo
        shuffledSameScore.forEach((player, index) => {
          if (forTeamA.length < maxPerTeam && forTeamB.length < maxPerTeam) {
            if (index % 2 === 0) {
              forTeamA.push({ ...player, assignedRole: role });
            } else {
              forTeamB.push({ ...player, assignedRole: role });
            }
          }
        });
      });

      // Determinar jugadores sobrantes
      const usedPlayers = [...forTeamA, ...forTeamB].map((p) => p.id);
      const remaining = players.filter((p) => !usedPlayers.includes(p.id));

      // Devolver jugadores a cada equipo y los sobrantes
      return {
        teamA: forTeamA,
        teamB: forTeamB,
        remaining,
      };
    };

    // Distribuir arqueros
    const gkResult = distributeRoleByMultiCriteria(
      PLAYER_ROLES.GOALKEEPER,
      FORMATION.GOALKEEPER
    );
    teamA.push(...gkResult.teamA);
    teamB.push(...gkResult.teamB);
    playersWithoutRole.push(...gkResult.remaining);

    // Distribuir defensores
    const defResult = distributeRoleByMultiCriteria(
      PLAYER_ROLES.DEFENDER,
      FORMATION.DEFENDERS
    );
    teamA.push(...defResult.teamA);
    teamB.push(...defResult.teamB);
    playersWithoutRole.push(...defResult.remaining);

    // Distribuir mediocampistas
    const midResult = distributeRoleByMultiCriteria(
      PLAYER_ROLES.MIDFIELDER,
      FORMATION.MIDFIELDERS
    );
    teamA.push(...midResult.teamA);
    teamB.push(...midResult.teamB);
    playersWithoutRole.push(...midResult.remaining);

    // Distribuir delanteros
    const fwdResult = distributeRoleByMultiCriteria(
      PLAYER_ROLES.FORWARD,
      FORMATION.FORWARDS
    );
    teamA.push(...fwdResult.teamA);
    teamB.push(...fwdResult.teamB);
    playersWithoutRole.push(...fwdResult.remaining);

    // Distribuir comodines y jugadores sobrantes por combinación de edad y rating
    const remainingWithWildcards = [
      ...playersWithoutRole,
      ...(playersByRole[PLAYER_ROLES.WILDCARD] || []),
    ];

    // MEJORA: Verificar si algún equipo necesita arquero antes de distribuir comodines
    const teamAHasGK = teamA.some(
      (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
    );
    const teamBHasGK = teamB.some(
      (p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER
    );

    if (!teamAHasGK || !teamBHasGK) {
      console.log(
        `🥅 Verificando arqueros después de distribución principal: A=${teamAHasGK}, B=${teamBHasGK}`
      );

      // Buscar jugadores con rol secundario de arquero en los sobrantes
      const goalkeeperCandidates = remainingWithWildcards.filter((player) => {
        return player.playerRoles?.some((role) => {
          if (typeof role === 'string') {
            return role === PLAYER_ROLES.GOALKEEPER;
          } else if (role && typeof role === 'object' && 'role' in role) {
            return role.role === PLAYER_ROLES.GOALKEEPER;
          }
          return false;
        });
      });

      // Asignar arqueros a equipos que los necesiten
      if (goalkeeperCandidates.length > 0) {
        if (!teamAHasGK && goalkeeperCandidates.length > 0) {
          const gkForA = goalkeeperCandidates.shift()!;
          teamA.push({ ...gkForA, assignedRole: PLAYER_ROLES.GOALKEEPER });
          console.log(
            `🥅 Asignado arquero secundario ${gkForA.name} al equipo A`
          );

          // Remover de la lista de sobrantes
          const indexToRemove = remainingWithWildcards.findIndex(
            (p) => p.id === gkForA.id
          );
          if (indexToRemove !== -1) {
            remainingWithWildcards.splice(indexToRemove, 1);
          }
        }

        if (!teamBHasGK && goalkeeperCandidates.length > 0) {
          const gkForB = goalkeeperCandidates.shift()!;
          teamB.push({ ...gkForB, assignedRole: PLAYER_ROLES.GOALKEEPER });
          console.log(
            `🥅 Asignado arquero secundario ${gkForB.name} al equipo B`
          );

          // Remover de la lista de sobrantes
          const indexToRemove = remainingWithWildcards.findIndex(
            (p) => p.id === gkForB.id
          );
          if (indexToRemove !== -1) {
            remainingWithWildcards.splice(indexToRemove, 1);
          }
        }
      }
    }

    // Ordenar jugadores restantes por combinación de edad y rating
    const sortedRemaining = [...remainingWithWildcards].sort((a, b) => {
      // Usar la misma fórmula de ponderación
      const scoreA = (a.starRating || 3) * 0.7 + ((a.age || 30) / 50) * 0.3;
      const scoreB = (b.starRating || 3) * 0.7 + ((b.age || 30) / 50) * 0.3;

      return scoreB - scoreA;
    });

    // Distribuir alternadamente para balancear
    sortedRemaining.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  }

  // Método para clasificar jugadores por rol
  private classifyPlayersByRole(players: Member[]): {
    playersByRole: Record<string, Member[]>;
    playersWithoutRole: Member[];
  } {
    const playersByRole: Record<string, Member[]> = {};
    const playersWithoutRole: Member[] = [];

    players.forEach((player) => {
      const primaryRole = getPrimaryRole(player.playerRoles);
      if (primaryRole) {
        if (!playersByRole[primaryRole]) {
          playersByRole[primaryRole] = [];
        }
        playersByRole[primaryRole].push(player);
      } else {
        playersWithoutRole.push(player);
      }
    });

    return { playersByRole, playersWithoutRole };
  }
}
