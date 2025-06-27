import { Member, TbdPlayer } from './types';
import { PlayerRole } from '../teambuilder/types';
import { calculateAge } from '../utils';

export const calculateAverageAge = (team: Member[]): number => {
  if (team.length === 0) return 0;

  const totalAge = team.reduce((sum, member) => {
    const age = member.birthdate
      ? calculateAge(member.birthdate) ?? 25
      : member.age ?? 25;
    return sum + age;
  }, 0);

  return totalAge / team.length;
};

export const generateTbdPlayer = (
  id: string,
  name: string,
  isTeamA: boolean,
  playerRoles?: PlayerRole[]
): TbdPlayer => {
  return {
    id,
    name,
    isTeamA,
    avatar: null,
    playerType: 'TBD',
    playerRoles: playerRoles || [],
  };
};

export const addTbdPlayers = (
  team: any[],
  isTeamA: boolean,
  requiredPlayersPerTeam: number = 11
): TbdPlayer[] => {
  const currentRealPlayers = team.filter(
    (player) =>
      player && typeof player.id === 'string' && !player.id.startsWith('tbd-')
  ).length;

  const tbdPlayersNeeded = Math.max(
    0,
    requiredPlayersPerTeam - currentRealPlayers
  );
  const tbdPlayers: TbdPlayer[] = [];

  console.log(
    `🤖 Generando ${tbdPlayersNeeded} jugadores TBD para ${
      isTeamA ? 'Equipo A' : 'Equipo B'
    }`
  );

  for (let i = 0; i < tbdPlayersNeeded; i++) {
    const tbdId = `tbd-${isTeamA ? 'a' : 'b'}-${Date.now()}-${i}`;
    const tbdName = `TBD ${isTeamA ? 'A' : 'B'}${i + 1}`;

    const tbdPlayer = generateTbdPlayer(tbdId, tbdName, isTeamA);
    tbdPlayers.push(tbdPlayer);

    console.log(`   ➕ Creado: ${tbdName} (${tbdId})`);
  }

  return tbdPlayers;
};

export const verifyFinalTeams = (teamA: any[], teamB: any[]) => {
  console.log('\n🔍 === VERIFICACIÓN FINAL DE EQUIPOS ===');

  // Verificar duplicados dentro de cada equipo
  const teamAIds = teamA.map((p) => p.id);
  const teamBIds = teamB.map((p) => p.id);

  const teamADuplicates = teamAIds.filter(
    (id, index) => teamAIds.indexOf(id) !== index
  );
  const teamBDuplicates = teamBIds.filter(
    (id, index) => teamBIds.indexOf(id) !== index
  );

  if (teamADuplicates.length > 0) {
    console.log(`⚠️ Duplicados en Equipo A: ${teamADuplicates.join(', ')}`);
  }

  if (teamBDuplicates.length > 0) {
    console.log(`⚠️ Duplicados en Equipo B: ${teamBDuplicates.join(', ')}`);
  }

  // Verificar jugadores en ambos equipos
  const intersection = teamAIds.filter((id) => teamBIds.includes(id));
  if (intersection.length > 0) {
    console.log(`🚨 Jugadores en ambos equipos: ${intersection.join(', ')}`);
  }

  // Estadísticas generales
  console.log(`📊 Equipo A: ${teamA.length} jugadores`);
  console.log(`📊 Equipo B: ${teamB.length} jugadores`);
  console.log(`📊 Total: ${teamA.length + teamB.length} jugadores`);

  // Verificar estructura de jugadores
  const invalidPlayersA = teamA.filter((p) => !p || !p.id || !p.name);
  const invalidPlayersB = teamB.filter((p) => !p || !p.id || !p.name);

  if (invalidPlayersA.length > 0) {
    console.log(
      `⚠️ Jugadores inválidos en Equipo A: ${invalidPlayersA.length}`
    );
  }

  if (invalidPlayersB.length > 0) {
    console.log(
      `⚠️ Jugadores inválidos en Equipo B: ${invalidPlayersB.length}`
    );
  }

  console.log('✅ Verificación completada');
};

export const removeDuplicates = (team: any[]): any[] => {
  const seen = new Set<string>();
  return team.filter((player) => {
    if (!player || !player.id) return false;
    if (seen.has(player.id)) {
      console.log(
        `⚠️ Jugador duplicado eliminado: ${player.name} (${player.id})`
      );
      return false;
    }
    seen.add(player.id);
    return true;
  });
};

export const ensureEvenRealPlayerDistribution = (
  teamA: Member[],
  teamB: Member[]
): [Member[], Member[]] => {
  console.log(
    '\n⚖️ === ASEGURANDO DISTRIBUCIÓN PAREJA DE JUGADORES REALES ==='
  );

  // Filtrar solo jugadores reales (no TBD)
  const realPlayersA = teamA.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );
  const realPlayersB = teamB.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );

  console.log(
    `👥 Jugadores reales - Equipo A: ${realPlayersA.length}, Equipo B: ${realPlayersB.length}`
  );

  // Si la diferencia es mayor a 1, redistribuir
  const difference = Math.abs(realPlayersA.length - realPlayersB.length);

  if (difference <= 1) {
    console.log('✅ Distribución ya está equilibrada');
    return [teamA, teamB];
  }

  console.log(
    `⚖️ Redistribuyendo ${Math.floor(difference / 2)} jugadores para equilibrar`
  );

  let newTeamA = [...teamA];
  let newTeamB = [...teamB];

  // Determinar qué equipo tiene más jugadores reales
  const teamWithMore = realPlayersA.length > realPlayersB.length ? 'A' : 'B';
  const playersToMove = Math.floor(difference / 2);

  if (teamWithMore === 'A') {
    // Mover jugadores de A a B
    const playersToMoveFromA = realPlayersA.slice(-playersToMove);
    newTeamA = newTeamA.filter(
      (p) => !playersToMoveFromA.some((pm) => pm.id === p.id)
    );
    newTeamB = [...newTeamB, ...playersToMoveFromA];

    console.log(`➡️ Movidos ${playersToMove} jugadores de Equipo A a Equipo B`);
  } else {
    // Mover jugadores de B a A
    const playersToMoveFromB = realPlayersB.slice(-playersToMove);
    newTeamB = newTeamB.filter(
      (p) => !playersToMoveFromB.some((pm) => pm.id === p.id)
    );
    newTeamA = [...newTeamA, ...playersToMoveFromB];

    console.log(`⬅️ Movidos ${playersToMove} jugadores de Equipo B a Equipo A`);
  }

  const finalRealA = newTeamA.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );
  const finalRealB = newTeamB.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );

  console.log(
    `✅ Nueva distribución - Equipo A: ${finalRealA.length}, Equipo B: ${finalRealB.length}`
  );

  return [newTeamA, newTeamB];
};

// Nueva función que redistribuye jugadores de manera aleatoria para preservar variabilidad
export const ensureEvenRealPlayerDistributionRandom = (
  teamA: Member[],
  teamB: Member[]
): [Member[], Member[]] => {
  console.log('\n🎲 === ASEGURANDO DISTRIBUCIÓN PAREJA CON VARIABILIDAD ===');

  // Filtrar solo jugadores reales (no TBD)
  const realPlayersA = teamA.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );
  const realPlayersB = teamB.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );

  console.log(
    `👥 Jugadores reales - Equipo A: ${realPlayersA.length}, Equipo B: ${realPlayersB.length}`
  );

  // Si la diferencia es mayor a 1, redistribuir
  const difference = Math.abs(realPlayersA.length - realPlayersB.length);

  if (difference <= 1) {
    console.log('✅ Distribución ya está equilibrada');
    return [teamA, teamB];
  }

  console.log(
    `🎲 Redistribuyendo ${Math.floor(
      difference / 2
    )} jugadores de manera aleatoria`
  );

  let newTeamA = [...teamA];
  let newTeamB = [...teamB];

  // Determinar qué equipo tiene más jugadores reales
  const teamWithMore = realPlayersA.length > realPlayersB.length ? 'A' : 'B';
  const playersToMove = Math.floor(difference / 2);

  if (teamWithMore === 'A') {
    // Mezclar aleatoriamente los jugadores del equipo A y tomar los primeros que necesitamos
    const shuffledPlayersA = [...realPlayersA].sort(() => Math.random() - 0.5);
    const playersToMoveFromA = shuffledPlayersA.slice(0, playersToMove);

    newTeamA = newTeamA.filter(
      (p) => !playersToMoveFromA.some((pm) => pm.id === p.id)
    );
    newTeamB = [...newTeamB, ...playersToMoveFromA];

    console.log(
      `🎲 Movidos ${playersToMove} jugadores aleatorios de Equipo A a Equipo B`
    );
  } else {
    // Mezclar aleatoriamente los jugadores del equipo B y tomar los primeros que necesitamos
    const shuffledPlayersB = [...realPlayersB].sort(() => Math.random() - 0.5);
    const playersToMoveFromB = shuffledPlayersB.slice(0, playersToMove);

    newTeamB = newTeamB.filter(
      (p) => !playersToMoveFromB.some((pm) => pm.id === p.id)
    );
    newTeamA = [...newTeamA, ...playersToMoveFromB];

    console.log(
      `🎲 Movidos ${playersToMove} jugadores aleatorios de Equipo B a Equipo A`
    );
  }

  const finalRealA = newTeamA.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );
  const finalRealB = newTeamB.filter(
    (p) => p && typeof p.id === 'string' && !p.id.startsWith('tbd-')
  );

  console.log(
    `✅ Nueva distribución aleatoria - Equipo A: ${finalRealA.length}, Equipo B: ${finalRealB.length}`
  );

  return [newTeamA, newTeamB];
};
