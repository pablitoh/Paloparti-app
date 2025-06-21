import { Member } from './types';
import { PLAYER_ROLES } from './constants';
import {
  assignFlexibleRole,
  getPrimaryRole,
  playerHasRole,
  getAvailablePlayersByRole,
} from './roleUtils';

export const balanceTeamPositions = (team: Member[]): Member[] => {
  // Asignar roles a jugadores que no tienen asignado un rol específico
  return team.map((player) => {
    if (!player.assignedRole) {
      // Si el jugador tiene roles preferidos, usar el primero como asignado
      const primaryRole = getPrimaryRole(player.playerRoles);
      if (primaryRole) {
        return { ...player, assignedRole: primaryRole };
      } else {
        // Si no tiene roles preferidos, asignar un rol flexible
        const availableRoles = Object.values(PLAYER_ROLES);
        const assignedRole = assignFlexibleRole(team, availableRoles);
        return { ...player, assignedRole: assignedRole };
      }
    }
    return player;
  });
};

export const assignPlayersToPosition = (
  targetRole: string,
  maxPlayers: number,
  availableByRole: Record<
    string,
    { primary: Member[]; secondary: Member[]; wildcard: Member[] }
  >,
  assignedPlayers: Set<string>,
  allPlayers: Member[] // Para fallback aleatorio
): Member[] => {
  const assigned: Member[] = [];
  const roleData = availableByRole[targetRole];

  if (!roleData) {
    console.log(`⚠️ No se encontraron datos para el rol: ${targetRole}`);
    return assigned;
  }

  // Función para asignar jugadores de una categoría específica
  const assignFromCategory = (players: Member[], categoryName: string) => {
    const availablePlayers = players.filter(
      (player) => !assignedPlayers.has(player.id)
    );

    console.log(`   - ${categoryName}: ${availablePlayers.length} disponibles`);

    for (const player of availablePlayers) {
      if (assigned.length >= maxPlayers) break;

      assigned.push({
        ...player,
        assignedRole: targetRole,
        positionForced: categoryName === 'wildcard',
      });
      assignedPlayers.add(player.id);

      // Debug específico para arqueros
      if (targetRole === PLAYER_ROLES.GOALKEEPER) {
        console.log(`🧤 ARQUERO ASIGNADO: ${player.name} (${categoryName})`);
      }

      console.log(
        `     ✅ Asignado: ${player.name} (${categoryName}) -> ${targetRole}`
      );
    }
  };

  console.log(
    `🎯 Asignando jugadores para ${targetRole} (máximo: ${maxPlayers})`
  );

  // 1. Primero asignar jugadores primarios
  assignFromCategory(roleData.primary, 'primario');

  // 2. Luego asignar jugadores secundarios
  if (assigned.length < maxPlayers) {
    assignFromCategory(roleData.secondary, 'secundario');
  }

  // 3. Finalmente asignar jugadores wildcard
  if (assigned.length < maxPlayers) {
    assignFromCategory(roleData.wildcard, 'wildcard');
  }

  // 4. Si aún faltan jugadores, usar fallback aleatorio de jugadores restantes
  if (assigned.length < maxPlayers) {
    const remainingPlayers = allPlayers.filter(
      (player) => !assignedPlayers.has(player.id)
    );

    console.log(
      `   - Fallback aleatorio: ${remainingPlayers.length} jugadores restantes`
    );

    // Aleatorizar el orden de los jugadores restantes
    const shuffledRemaining = remainingPlayers.sort(() => Math.random() - 0.5);

    for (const player of shuffledRemaining) {
      if (assigned.length >= maxPlayers) break;

      assigned.push({
        ...player,
        assignedRole: targetRole,
        positionForced: true, // Marca como forzado porque no es su rol preferido
      });
      assignedPlayers.add(player.id);

      console.log(
        `     ✅ Asignado (fallback): ${player.name} -> ${targetRole}`
      );
    }
  }

  console.log(
    `   📊 Total asignados para ${targetRole}: ${assigned.length}/${maxPlayers}`
  );

  return assigned;
};

export const createIntelligentRoleBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  console.log('\n🎯 === CREANDO EQUIPOS INTELIGENTES BALANCEADOS POR ROL ===');
  console.log(`📊 Total de jugadores: ${members.length}`);

  if (members.length === 0) {
    return [[], []];
  }

  // Primero, clasificar jugadores por sus roles
  const availableByRole = getAvailablePlayersByRole(members);

  // Imprimir estadísticas de roles disponibles
  console.log('\n📋 Jugadores disponibles por rol:');
  Object.entries(availableByRole).forEach(([role, players]) => {
    const total =
      players.primary.length +
      players.secondary.length +
      players.wildcard.length;
    console.log(
      `   ${role}: ${total} total (${players.primary.length} primarios, ${players.secondary.length} secundarios, ${players.wildcard.length} wildcard)`
    );

    // Debug específico para arqueros
    if (role === PLAYER_ROLES.GOALKEEPER) {
      console.log('🧤 DEBUG ARQUEROS:');
      players.primary.forEach((p) =>
        console.log(
          `   PRIMARIO: ${p.name} - roles: ${JSON.stringify(p.playerRoles)}`
        )
      );
      players.secondary.forEach((p) =>
        console.log(
          `   SECUNDARIO: ${p.name} - roles: ${JSON.stringify(p.playerRoles)}`
        )
      );
      players.wildcard.forEach((p) =>
        console.log(
          `   WILDCARD: ${p.name} - roles: ${JSON.stringify(p.playerRoles)}`
        )
      );
    }
  });

  // Calcular formación ideal basada en el número de jugadores
  const totalPlayers = members.length;
  const playersPerTeam = Math.floor(totalPlayers / 2);

  console.log(
    `\n🏗️ Formación objetivo: ${playersPerTeam} jugadores por equipo`
  );

  // Determinar distribución de roles por equipo
  const roleDistribution = {
    [PLAYER_ROLES.GOALKEEPER]: playersPerTeam >= 2 ? 1 : 0, // 1 arquero por equipo si hay al menos 2 jugadores
    [PLAYER_ROLES.DEFENDER]: Math.max(1, Math.floor(playersPerTeam * 0.3)), // ~30% defensores
    [PLAYER_ROLES.MIDFIELDER]: Math.max(1, Math.floor(playersPerTeam * 0.4)), // ~40% mediocampistas
    [PLAYER_ROLES.FORWARD]: Math.max(1, Math.floor(playersPerTeam * 0.3)), // ~30% delanteros
  };

  console.log(
    `🧤 DEBUG: playersPerTeam = ${playersPerTeam}, arqueros = ${
      roleDistribution[PLAYER_ROLES.GOALKEEPER]
    }`
  );

  // Ajustar distribución para que coincida con el total de jugadores por equipo
  const totalDistributed = Object.values(roleDistribution).reduce(
    (a, b) => a + b,
    0
  );
  const remaining = playersPerTeam - totalDistributed;

  if (remaining > 0) {
    // Distribuir jugadores restantes priorizando mediocampo
    roleDistribution[PLAYER_ROLES.MIDFIELDER] += remaining;
  }

  console.log('\n📊 Distribución de roles por equipo:');
  Object.entries(roleDistribution).forEach(([role, count]) => {
    console.log(`   ${role}: ${count} jugadores`);
  });

  // Inicializar equipos
  let teamA: Member[] = [];
  let teamB: Member[] = [];
  const assignedPlayers = new Set<string>();

  // Asignar jugadores por rol, alternando entre equipos
  Object.entries(roleDistribution).forEach(([role, countPerTeam]) => {
    const totalForRole = countPerTeam * 2; // Para ambos equipos
    const playersForRole = assignPlayersToPosition(
      role,
      totalForRole,
      availableByRole,
      assignedPlayers,
      members
    );

    console.log(
      `\n🎯 Distribuyendo ${playersForRole.length} jugadores de ${role}`
    );

    // Distribuir jugadores entre equipos alternadamente
    playersForRole.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player);
        console.log(`   👥 Equipo A: ${player.name} (${role})`);
      } else {
        teamB.push(player);
        console.log(`   👥 Equipo B: ${player.name} (${role})`);
      }
    });
  });

  // Asignar jugadores restantes (si los hay)
  const remainingPlayers = members.filter(
    (player) => !assignedPlayers.has(player.id)
  );

  if (remainingPlayers.length > 0) {
    console.log(
      `\n🔄 Asignando ${remainingPlayers.length} jugadores restantes`
    );

    remainingPlayers.forEach((player, index) => {
      const assignedRole = assignFlexibleRole(
        index % 2 === 0 ? teamA : teamB,
        Object.values(PLAYER_ROLES)
      );

      const playerWithRole = {
        ...player,
        assignedRole,
        positionForced: true,
      };

      if (index % 2 === 0) {
        teamA.push(playerWithRole);
        console.log(
          `   👥 Equipo A: ${player.name} (${assignedRole}) - restante`
        );
      } else {
        teamB.push(playerWithRole);
        console.log(
          `   👥 Equipo B: ${player.name} (${assignedRole}) - restante`
        );
      }
    });
  }

  // Balancear posiciones en cada equipo
  teamA = balanceTeamPositions(teamA);
  teamB = balanceTeamPositions(teamB);

  console.log(`\n✅ Equipos finales:`);
  console.log(`   Equipo A: ${teamA.length} jugadores`);
  console.log(`   Equipo B: ${teamB.length} jugadores`);

  return [teamA, teamB];
};

export const determineSmartRole = (player: Member, team: Member[]): string => {
  // Si el jugador ya tiene un rol asignado, usarlo
  if (player.assignedRole) {
    return player.assignedRole;
  }

  // Si el jugador tiene roles preferidos, usar el primero
  const primaryRole = getPrimaryRole(player.playerRoles);
  if (primaryRole) {
    return primaryRole;
  }

  // Si no tiene roles preferidos, asignar un rol flexible basado en el equipo actual
  const availableRoles = Object.values(PLAYER_ROLES);
  return assignFlexibleRole(team, availableRoles);
};
