interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  playerType?: string;
  avatar?: string | null;
  age?: number | null;
}

interface TbdPlayersStructure {
  teamA: TbdPlayer[];
  teamB: TbdPlayer[];
}

/**
 * Genera un nombre consistente para un TBD player basado en su equipo y posición
 */
function generateTbdPlayerName(isTeamA: boolean, index: number): string {
  const team = isTeamA ? 'A' : 'B';
  return `Fantasma ${team}${index + 1}`;
}

/**
 * Normaliza los TBD players desde cualquier formato a una estructura consistente
 * @param tbdPlayersData - Los datos de TBD players en cualquier formato
 * @returns Estructura normalizada con teamA y teamB
 */
export function normalizeTbdPlayers(tbdPlayersData: any): TbdPlayersStructure {
  const result: TbdPlayersStructure = { teamA: [], teamB: [] };

  if (!tbdPlayersData) {
    return result;
  }

  try {
    // Parse JSON string if needed
    let tbdData = tbdPlayersData;
    if (typeof tbdPlayersData === 'string') {
      tbdData = JSON.parse(tbdPlayersData);
    }

    // Handle array format
    if (Array.isArray(tbdData)) {
      tbdData.forEach((player: any) => {
        const normalizedPlayer = normalizePlayer(player);
        if (normalizedPlayer) {
          if (normalizedPlayer.isTeamA) {
            result.teamA.push(normalizedPlayer);
          } else {
            result.teamB.push(normalizedPlayer);
          }
        }
      });
    }
    // Handle object with teamA/teamB structure
    else if (typeof tbdData === 'object' && (tbdData.teamA || tbdData.teamB)) {
      if (Array.isArray(tbdData.teamA)) {
        result.teamA = tbdData.teamA
          .map((player: any) => normalizePlayer(player, true))
          .filter(Boolean);
      }
      if (Array.isArray(tbdData.teamB)) {
        result.teamB = tbdData.teamB
          .map((player: any) => normalizePlayer(player, false))
          .filter(Boolean);
      }
    }
    // Handle single player object
    else if (typeof tbdData === 'object' && tbdData.id && tbdData.name) {
      const normalizedPlayer = normalizePlayer(tbdData);
      if (normalizedPlayer) {
        if (normalizedPlayer.isTeamA) {
          result.teamA.push(normalizedPlayer);
        } else {
          result.teamB.push(normalizedPlayer);
        }
      }
    }
    // Handle any other object format by recursively searching for players
    else {
      const extractedPlayers = extractPlayersRecursively(tbdData);
      extractedPlayers.forEach((player) => {
        if (player.isTeamA) {
          result.teamA.push(player);
        } else {
          result.teamB.push(player);
        }
      });
    }

    // Asegurar nombres consistentes después de normalizar
    result.teamA = result.teamA.map((player, index) => ({
      ...player,
      name: generateTbdPlayerName(true, index),
    }));

    result.teamB = result.teamB.map((player, index) => ({
      ...player,
      name: generateTbdPlayerName(false, index),
    }));

    return result;
  } catch (error) {
    console.error('Error normalizing TBD players:', error);
    return result;
  }
}

/**
 * Normaliza un jugador individual
 */
function normalizePlayer(player: any, forceTeam?: boolean): TbdPlayer | null {
  if (!player || typeof player !== 'object' || !player.id) {
    return null;
  }

  return {
    id: player.id,
    name: player.name || 'Fantasma',
    isTeamA: forceTeam !== undefined ? forceTeam : !!player.isTeamA,
    playerType: player.playerType || 'TBD',
    avatar: player.avatar || null,
    age: player.age || null,
  };
}

/**
 * Extrae jugadores de manera recursiva desde cualquier estructura de objeto
 */
function extractPlayersRecursively(data: any): TbdPlayer[] {
  const players: TbdPlayer[] = [];

  if (!data || typeof data !== 'object') {
    return players;
  }

  // Check if current object is a player
  if (data.id && data.name) {
    const player = normalizePlayer(data);
    if (player) {
      players.push(player);
    }
    return players;
  }

  // Recursively search in object values
  Object.values(data).forEach((value: any) => {
    if (Array.isArray(value)) {
      value.forEach((item: any) => {
        const player = normalizePlayer(item);
        if (player) {
          players.push(player);
        }
      });
    } else if (value && typeof value === 'object') {
      players.push(...extractPlayersRecursively(value));
    }
  });

  return players;
}

/**
 * Convierte la estructura normalizada de vuelta al formato de base de datos
 */
export function serializeTbdPlayers(tbdPlayers: TbdPlayersStructure): any {
  return {
    teamA: tbdPlayers.teamA,
    teamB: tbdPlayers.teamB,
  };
}

/**
 * Busca un jugador TBD por ID en la estructura normalizada
 */
export function findTbdPlayer(
  tbdPlayers: TbdPlayersStructure,
  playerId: string,
  isTeamA: boolean
): TbdPlayer | null {
  const team = isTeamA ? tbdPlayers.teamA : tbdPlayers.teamB;
  return team.find((player) => player.id === playerId) || null;
}

export type { TbdPlayer, TbdPlayersStructure };
