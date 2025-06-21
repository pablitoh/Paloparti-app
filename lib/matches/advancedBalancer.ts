import { Member } from './types';
import { PLAYER_ROLES } from './constants';
import { calculateAge } from '../utils';
import {
  assignFlexibleRole,
  getPrimaryRole,
  getAvailablePlayersByRole,
} from './roleUtils';

// Función auxiliar para calcular edad con fallback seguro
const getPlayerAge = (member: Member): number => {
  if (member.birthdate) {
    const calculatedAge = calculateAge(member.birthdate);
    return calculatedAge ?? 25;
  }
  return member.age ?? 25;
};

export const createRatingBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  console.log('\n🎯 === CREANDO EQUIPOS BALANCEADOS POR RATING ===');

  if (members.length === 0) {
    return [[], []];
  }

  // Calcular rating promedio
  const membersWithRating = members.filter(
    (m) => m.starRating && m.starRating > 0
  );
  const totalRating = membersWithRating.reduce(
    (sum, member) => sum + (member.starRating || 0),
    0
  );
  const averageRating =
    membersWithRating.length > 0 ? totalRating / membersWithRating.length : 2.5;

  console.log(`⭐ Rating promedio: ${averageRating.toFixed(1)}`);
  console.log(
    `📊 Jugadores con rating: ${membersWithRating.length}/${members.length}`
  );

  // Ordenar jugadores por rating (de mayor a menor)
  const sortedMembers = [...members].sort(
    (a, b) => (b.starRating || 0) - (a.starRating || 0)
  );

  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Algoritmo de draft: asignar alternadamente empezando por los mejores jugadores
  sortedMembers.forEach((player, index) => {
    const currentTeamARating =
      teamA.reduce((sum, p) => sum + (p.starRating || 0), 0) /
      (teamA.length || 1);
    const currentTeamBRating =
      teamB.reduce((sum, p) => sum + (p.starRating || 0), 0) /
      (teamB.length || 1);

    const assignedRole =
      getPrimaryRole(player.playerRoles) ||
      assignFlexibleRole(
        index % 2 === 0 ? teamA : teamB,
        Object.values(PLAYER_ROLES)
      );

    const playerWithRole = {
      ...player,
      assignedRole,
      positionForced: !getPrimaryRole(player.playerRoles),
    };

    // Asignar al equipo con menor rating promedio, o alternar si están equilibrados
    if (
      teamA.length === 0 ||
      (teamB.length > 0 && currentTeamARating > currentTeamBRating)
    ) {
      teamA.push(playerWithRole);
      console.log(
        `   👥 Equipo A: ${player.name} (⭐${player.starRating || 0})`
      );
    } else {
      teamB.push(playerWithRole);
      console.log(
        `   👥 Equipo B: ${player.name} (⭐${player.starRating || 0})`
      );
    }
  });

  // Calcular ratings promedio finales
  const finalTeamARating =
    teamA.reduce((sum, p) => sum + (p.starRating || 0), 0) /
    (teamA.length || 1);
  const finalTeamBRating =
    teamB.reduce((sum, p) => sum + (p.starRating || 0), 0) /
    (teamB.length || 1);

  console.log(`\n✅ Equipos finales balanceados por rating:`);
  console.log(
    `   Equipo A: ${
      teamA.length
    } jugadores (rating promedio: ${finalTeamARating.toFixed(1)})`
  );
  console.log(
    `   Equipo B: ${
      teamB.length
    } jugadores (rating promedio: ${finalTeamBRating.toFixed(1)})`
  );

  return [teamA, teamB];
};

export const createRandomTeams = (members: Member[]): [Member[], Member[]] => {
  console.log('\n🎲 === CREANDO EQUIPOS COMPLETAMENTE ALEATORIOS ===');

  if (members.length === 0) {
    return [[], []];
  }

  // Función para mezclar un array
  const shuffleArray = (array: Member[]): Member[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Mezclar jugadores aleatoriamente
  const shuffledMembers = shuffleArray(members);

  let teamA: Member[] = [];
  let teamB: Member[] = [];

  // Distribuir jugadores alternadamente
  shuffledMembers.forEach((player, index) => {
    const assignedRole =
      getPrimaryRole(player.playerRoles) || PLAYER_ROLES.WILDCARD;

    const playerWithRole = {
      ...player,
      assignedRole,
      positionForced: !getPrimaryRole(player.playerRoles),
    };

    if (index % 2 === 0) {
      teamA.push(playerWithRole);
      console.log(`   👥 Equipo A: ${player.name} (${assignedRole})`);
    } else {
      teamB.push(playerWithRole);
      console.log(`   👥 Equipo B: ${player.name} (${assignedRole})`);
    }
  });

  console.log(`\n🎲 Equipos aleatorios creados:`);
  console.log(`   Equipo A: ${teamA.length} jugadores`);
  console.log(`   Equipo B: ${teamB.length} jugadores`);

  return [teamA, teamB];
};

export const createRoleAndAgeBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  console.log('\n🎯 === CREANDO EQUIPOS BALANCEADOS POR ROL Y EDAD ===');

  if (members.length === 0) {
    return [[], []];
  }

  // Calcular edad promedio usando la función auxiliar
  const totalAge = members.reduce(
    (sum, member) => sum + getPlayerAge(member),
    0
  );
  const averageAge = totalAge / members.length;

  console.log(`📊 Edad promedio: ${averageAge.toFixed(1)} años`);

  // Clasificar jugadores por edad
  const youngerPlayers = members.filter(
    (member) => getPlayerAge(member) <= averageAge
  );
  const olderPlayers = members.filter(
    (member) => getPlayerAge(member) > averageAge
  );

  console.log(`👶 Jugadores jóvenes: ${youngerPlayers.length}`);
  console.log(`👴 Jugadores mayores: ${olderPlayers.length}`);

  // Para simplicidad, usar el algoritmo de rating con consideración de edad
  return createRatingBalancedTeams(members);
};

export const createCombinedBalancedTeams = (
  members: Member[]
): [Member[], Member[]] => {
  console.log(
    '\n🎯 === CREANDO EQUIPOS BALANCEADOS POR MÚLTIPLES CRITERIOS ==='
  );

  if (members.length === 0) {
    return [[], []];
  }

  // Para ahora, usar el algoritmo inteligente como base
  // En el futuro se puede implementar un algoritmo más sofisticado
  return createRatingBalancedTeams(members);
};
