import React from 'react';
import { Avatar } from '@mui/material';
import { UserIcon } from '@heroicons/react/24/outline';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { PLAYER_ROLES } from '../AttendanceConfirmation';
import StarRating from '../../StarRating';

// Mapeo de roles a iconos y prioridad (para ordenamiento)
const ROLE_ICONS: Record<
  string,
  { icon: React.ReactElement; priority: number }
> = {
  [PLAYER_ROLES.GOALKEEPER]: {
    icon: (
      <div title='Arquero' className='text-lg'>
        🧤
      </div>
    ),
    priority: 0,
  },
  [PLAYER_ROLES.DEFENDER]: {
    icon: (
      <div title='Defensor' className='text-lg'>
        🛡️
      </div>
    ),
    priority: 1,
  },
  [PLAYER_ROLES.MIDFIELDER]: {
    icon: (
      <div title='Mediocampo' className='text-lg'>
        ⚽
      </div>
    ),
    priority: 2,
  },
  [PLAYER_ROLES.FORWARD]: {
    icon: (
      <div title='Delantero' className='text-lg'>
        👟
      </div>
    ),
    priority: 3,
  },
  [PLAYER_ROLES.WILDCARD]: {
    icon: (
      <div title='Comodín' className='text-lg'>
        🔄
      </div>
    ),
    priority: 4,
  },
};

interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
  playerType?: string;
  playerRoles?: string[]; // Array de roles del jugador
  assignedRole?: string; // Rol asignado para la formación
  age?: number;
  starRating?: number; // Nivel de habilidad del jugador
}

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType?: string;
  playerRoles?: string[]; // Array de roles del jugador
  assignedRole?: string; // Rol asignado para la formación
  age?: number;
  starRating?: number; // Nivel de habilidad del jugador
}

interface TeamsListProps {
  playersA: Player[];
  playersB: Player[];
  tbdPlayers?: TbdPlayer[];
  teamAName: string;
  teamBName: string;
  currentUserIsAdmin: boolean;
  onReplaceTbd?: (playerId: string) => void;
  teamAAvgAge?: number; // Promedio de edad del equipo A
  teamBAvgAge?: number; // Promedio de edad del equipo B
}

interface PlayerItemProps {
  player: Player | TbdPlayer;
  isTbd?: boolean;
  showReplaceButton?: boolean;
}

interface TeamSectionProps {
  players: Player[];
  tbdPlayers: TbdPlayer[];
  teamName: string;
  colorClass: string;
  avgAge?: number; // Promedio de edad del equipo
}

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (playerRoles?: string[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Encontrar el rol con la prioridad más alta (número más bajo tiene mayor prioridad)
  return playerRoles.reduce((primaryRole, currentRole) => {
    const primaryPriority = ROLE_ICONS[primaryRole]?.priority ?? 999;
    const currentPriority = ROLE_ICONS[currentRole]?.priority ?? 999;
    return currentPriority < primaryPriority ? currentRole : primaryRole;
  }, playerRoles[0]);
};

// Función para ordenar jugadores por rol
const sortPlayersByRole = (
  players: (Player | TbdPlayer)[]
): (Player | TbdPlayer)[] => {
  return [...players].sort((a, b) => {
    const roleA = getPrimaryRole(a.playerRoles);
    const roleB = getPrimaryRole(b.playerRoles);

    // Si algún jugador no tiene rol, ponerlo al final
    if (!roleA && !roleB) return 0;
    if (!roleA) return 1;
    if (!roleB) return -1;

    // Ordenar por prioridad de rol
    return (
      (ROLE_ICONS[roleA]?.priority ?? 999) -
      (ROLE_ICONS[roleB]?.priority ?? 999)
    );
  });
};

// Función para obtener roles del jugador desde datos adicionales
const getPlayerRoles = (player: Player | TbdPlayer): string[] => {
  // Si el jugador tiene roles directamente definidos, usarlos
  if (player.playerRoles && Array.isArray(player.playerRoles)) {
    return player.playerRoles;
  }

  // Si no tiene roles, devolver array vacío
  return [];
};

const TeamsList: React.FC<TeamsListProps> = ({
  playersA,
  playersB,
  tbdPlayers = [],
  teamAName,
  teamBName,
  currentUserIsAdmin,
  onReplaceTbd,
  teamAAvgAge,
  teamBAvgAge,
}) => {
  // Logs para depuración
  console.log('TeamsList renderizado con props:', {
    teamAAvgAge,
    teamBAvgAge,
    playersA: playersA?.length,
    playersB: playersB?.length,
    tbdPlayers: tbdPlayers?.length,
  });

  // Calcular promedios localmente si no vienen en props
  const calculateLocalAvgAge = (players: any[]): number | undefined => {
    if (!players || players.length === 0) return undefined;

    // Contar jugadores con edad definida
    const playersWithAge = players.filter(
      (p) => p.age !== undefined && p.age !== null
    );

    // Si no hay jugadores con edad, devolver undefined
    if (playersWithAge.length === 0) {
      console.log('No hay jugadores con edad definida');
      return undefined;
    }

    // Calcular la suma de edades y el promedio
    const sum = playersWithAge.reduce(
      (acc, player) => acc + (player.age || 0),
      0
    );
    const avg = Math.round(sum / playersWithAge.length);

    console.log(
      `Calculado promedio local: ${avg} basado en ${playersWithAge.length} jugadores`
    );
    return avg;
  };

  // Usar valores de props o calcular localmente
  const effectiveTeamAAvgAge = teamAAvgAge ?? calculateLocalAvgAge(playersA);
  const effectiveTeamBAvgAge = teamBAvgAge ?? calculateLocalAvgAge(playersB);

  console.log('Promedios efectivos calculados:', {
    effectiveTeamAAvgAge,
    effectiveTeamBAvgAge,
  });

  // Filtrar TBD players por equipo
  const teamATbdPlayers = tbdPlayers.filter((player) => player.isTeamA);
  const teamBTbdPlayers = tbdPlayers.filter((player) => !player.isTeamA);

  // Componente reutilizable para un jugador
  const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    isTbd = false,
    showReplaceButton = false,
  }) => {
    // Obtener roles del jugador y determinar el rol principal
    const playerRoles = getPlayerRoles(player);

    // Priorizar el rol asignado si existe
    const displayRole = player.assignedRole || getPrimaryRole(playerRoles);

    // Mostrar el ícono del rol asignado primero, seguido por los demás roles seleccionados
    const allRoles = displayRole
      ? [displayRole, ...playerRoles.filter((role) => role !== displayRole)]
      : playerRoles;

    // Eliminar duplicados
    const uniqueRoles = [...new Set(allRoles)];

    // Obtener íconos para los roles
    const roleIcons = uniqueRoles.map((role) => ROLE_ICONS[role]?.icon);

    return (
      <li className='py-2 flex items-center justify-between'>
        <div className='flex items-center gap-2 sm:gap-3'>
          {isTbd ? (
            <div className='h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-200 flex items-center justify-center'>
              <UserIcon className='h-5 w-5 sm:h-6 sm:w-6 text-gray-500' />
            </div>
          ) : (
            <Avatar
              src={player.avatar || ''}
              alt={player.name || 'Jugador'}
              className='h-8 w-8 sm:h-10 sm:w-10 rounded-full'
            />
          )}
          <div className='min-w-0'>
            <div className='flex items-center'>
              <p className='font-medium text-gray-800 text-sm sm:text-base truncate max-w-[120px] sm:max-w-full'>
                {player.name || (isTbd ? 'TBD' : 'Jugador sin nombre')}
                {player.age && !isTbd && (
                  <span className='text-gray-400 font-normal ml-1'>
                    ({player.age})
                  </span>
                )}
              </p>
              <div className='flex space-x-1 ml-2'>
                {roleIcons.map((icon, index) => (
                  <span
                    key={index}
                    className={`flex-shrink-0 ${
                      index === 0 && player.assignedRole
                        ? 'bg-yellow-100 p-1 rounded-full'
                        : ''
                    }`}
                    title={uniqueRoles[index]}
                  >
                    {icon}
                  </span>
                ))}
              </div>
            </div>
            {(player.playerType === 'TBD' || isTbd) && (
              <span className='text-xs text-gray-500 italic'>
                Jugador pendiente
              </span>
            )}
            {!isTbd && player.assignedRole && (
              <span className='text-xs text-gray-600 font-medium'>
                {player.assignedRole === PLAYER_ROLES.GOALKEEPER
                  ? 'Arquero'
                  : player.assignedRole === PLAYER_ROLES.DEFENDER
                  ? 'Defensor'
                  : player.assignedRole === PLAYER_ROLES.MIDFIELDER
                  ? 'Mediocampista'
                  : player.assignedRole === PLAYER_ROLES.FORWARD
                  ? 'Delantero'
                  : 'Comodín'}
              </span>
            )}
            {!isTbd && player.starRating !== undefined && (
              <div className='mt-1'>
                <StarRating
                  key={`rating-${player.id}-${player.starRating}`}
                  rating={player.starRating}
                  readOnly={true}
                  size='sm'
                />
              </div>
            )}
          </div>
        </div>

        {showReplaceButton && currentUserIsAdmin && onReplaceTbd && (
          <button
            onClick={() => onReplaceTbd(player.id)}
            className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors'
            title='Reemplazar jugador'
          >
            <UserPlusIcon className='h-4 w-4 sm:h-5 sm:w-5' />
          </button>
        )}
      </li>
    );
  };

  // Componente para un equipo
  const TeamSection: React.FC<TeamSectionProps> = ({
    players,
    tbdPlayers,
    teamName,
    colorClass,
    avgAge,
  }) => {
    // Verificar si este equipo específico tiene promedio de edad
    console.log(`TeamSection "${teamName}" avgAge:`, avgAge);

    // Ordenar los jugadores por rol
    const sortedPlayers = sortPlayersByRole(players);
    const sortedTbdPlayers = sortPlayersByRole(tbdPlayers);

    return (
      <div className='p-4 w-full'>
        <div className='text-center mb-4'>
          <h3 className={`text-lg sm:text-xl font-bold ${colorClass}`}>
            {teamName}
          </h3>
          {/* Mostrar el promedio de edad con un estilo más visible para depurar */}
          {avgAge !== undefined ? (
            <p className='text-sm font-medium text-gray-500 mt-1'>({avgAge})</p>
          ) : (
            <p className='text-xs text-gray-400 mt-1'>(—)</p>
          )}
        </div>

        <ul className='divide-y divide-gray-100'>
          {/* Regular players */}
          {sortedPlayers.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              showReplaceButton={player.playerType === 'TBD'}
            />
          ))}

          {/* TBD players */}
          {sortedTbdPlayers.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              isTbd={true}
              showReplaceButton={true}
            />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'>
      {/* En móvil: equipos apilados verticalmente */}
      {/* En tablet/desktop: equipos lado a lado */}
      <div className='flex flex-col md:flex-row md:justify-center'>
        {/* Team A */}
        <div className='w-full md:w-1/2 md:border-r md:border-gray-200'>
          <TeamSection
            players={playersA}
            tbdPlayers={teamATbdPlayers}
            teamName={teamAName || 'Equipo A'}
            colorClass='text-blue-600'
            avgAge={effectiveTeamAAvgAge}
          />
        </div>

        {/* Separador visual en móvil */}
        <div className='border-t border-gray-200 md:hidden'></div>

        {/* Team B */}
        <div className='w-full md:w-1/2'>
          <TeamSection
            players={playersB}
            tbdPlayers={teamBTbdPlayers}
            teamName={teamBName || 'Equipo B'}
            colorClass='text-red-600'
            avgAge={effectiveTeamBAvgAge}
          />
        </div>
      </div>
    </div>
  );
};

export default TeamsList;
