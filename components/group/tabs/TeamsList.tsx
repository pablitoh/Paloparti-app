import React from 'react';
import { Avatar } from '@mui/material';
import {
  UserIcon,
  UserPlusIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { PLAYER_ROLES } from '../AttendanceConfirmation';
import StarRating from '../../StarRating';
import { PlayerRole } from '../../../lib/teambuilder/constants';

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
  playerRoles?: PlayerRole[]; // Array de roles del jugador con prioridades
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
  playerRoles?: PlayerRole[]; // Array de roles del jugador con prioridades
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
  onSwapPlayer?: (playerId: string, isTeamA: boolean) => void;
  teamAAvgAge?: number; // Promedio de edad del equipo A
  teamBAvgAge?: number; // Promedio de edad del equipo B
  teamAAvgRating?: number; // Promedio de star rating del equipo A
  teamBAvgRating?: number; // Promedio de star rating del equipo B
  sortCount?: number; // Contador de sorteos para forzar regeneración
}

interface PlayerItemProps {
  player: Player | TbdPlayer;
  isTbd?: boolean;
  showReplaceButton?: boolean;
  isTeamA: boolean;
}

interface TeamSectionProps {
  players: Player[];
  tbdPlayers: TbdPlayer[];
  teamName: string;
  colorClass: string;
  avgAge?: number; // Promedio de edad del equipo
  avgRating?: number; // Promedio de star rating del equipo
}

// Función para obtener el rol principal de un jugador (el de mayor prioridad)
const getPrimaryRole = (playerRoles?: PlayerRole[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;

  // Ordenar por prioridad (menor número = mayor prioridad) y devolver el primer rol
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0].role;
};

// Función para ordenar jugadores por rol
const sortPlayersByRole = (
  players: (Player | TbdPlayer)[]
): (Player | TbdPlayer)[] => {
  return [...players].sort((a, b) => {
    const roleA = getPrimaryRole(a.playerRoles) || a.assignedRole;
    const roleB = getPrimaryRole(b.playerRoles) || b.assignedRole;

    // Si algún jugador no tiene rol, ponerlo al final
    if (!roleA && !roleB) return 0;
    if (!roleA) return 1;
    if (!roleB) return -1;

    // Ordenar estrictamente por tipo de posición (prioridad)
    const priorityA = ROLE_ICONS[roleA]?.priority ?? 999;
    const priorityB = ROLE_ICONS[roleB]?.priority ?? 999;

    return priorityA - priorityB;
  });
};

// Función para obtener roles del jugador desde datos adicionales
const getPlayerRoles = (player: Player | TbdPlayer): string[] => {
  // Si el jugador tiene roles directamente definidos, extraer los roles
  if (player.playerRoles && Array.isArray(player.playerRoles)) {
    // Si es PlayerRole[], extraer solo los roles
    if (
      player.playerRoles.length > 0 &&
      typeof player.playerRoles[0] === 'object' &&
      'role' in player.playerRoles[0]
    ) {
      return (player.playerRoles as PlayerRole[]).map((pr) => pr.role);
    }
    // Si es string[] (formato antiguo), devolverlo directamente
    return player.playerRoles as unknown as string[];
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
  onSwapPlayer,
  teamAAvgAge,
  teamBAvgAge,
  teamAAvgRating,
  teamBAvgRating,
  sortCount = 0,
}) => {
  // Logs para depuración
  console.log('TeamsList renderizado con props:', {
    teamAAvgAge,
    teamBAvgAge,
    teamAAvgRating,
    teamBAvgRating,
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

  // Calcular promedios de star rating localmente si no vienen en props
  const calculateLocalAvgRating = (players: any[]): number | undefined => {
    if (!players || players.length === 0) return undefined;

    // Contar jugadores con rating definido
    const playersWithRating = players.filter(
      (p) => p.starRating !== undefined && p.starRating !== null
    );

    // Si no hay jugadores con rating, devolver undefined
    if (playersWithRating.length === 0) {
      console.log('No hay jugadores con star rating definido');
      return undefined;
    }

    // Calcular la suma de ratings y el promedio
    const sum = playersWithRating.reduce(
      (acc, player) => acc + (player.starRating || 0),
      0
    );
    const avg = (sum / playersWithRating.length).toFixed(1);

    console.log(
      `Calculado promedio de rating local: ${avg} basado en ${playersWithRating.length} jugadores`
    );
    return parseFloat(avg);
  };

  // Usar valores de props o calcular localmente
  const effectiveTeamAAvgAge = teamAAvgAge ?? calculateLocalAvgAge(playersA);
  const effectiveTeamBAvgAge = teamBAvgAge ?? calculateLocalAvgAge(playersB);
  const effectiveTeamAAvgRating =
    teamAAvgRating ?? calculateLocalAvgRating(playersA);
  const effectiveTeamBAvgRating =
    teamBAvgRating ?? calculateLocalAvgRating(playersB);

  console.log('Promedios efectivos calculados:', {
    effectiveTeamAAvgAge,
    effectiveTeamBAvgAge,
    effectiveTeamAAvgRating,
    effectiveTeamBAvgRating,
  });

  // Filtrar TBD players por equipo
  const teamATbdPlayers = tbdPlayers.filter((player) => player.isTeamA);
  const teamBTbdPlayers = tbdPlayers.filter((player) => !player.isTeamA);

  // Componente reutilizable para un jugador
  const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    isTbd = false,
    showReplaceButton = false,
    isTeamA,
  }) => {
    // Obtener roles del jugador y determinar el rol principal
    const playerRoles = getPlayerRoles(player);

    // Función para obtener roles ordenados por prioridad del usuario
    const getUserSelectedRoles = (): string[] => {
      if (player.playerRoles && Array.isArray(player.playerRoles)) {
        // Si es PlayerRole[], ordenar por prioridad
        if (
          player.playerRoles.length > 0 &&
          typeof player.playerRoles[0] === 'object' &&
          'role' in player.playerRoles[0]
        ) {
          const sortedRoles = [...(player.playerRoles as PlayerRole[])].sort(
            (a, b) => a.priority - b.priority
          );
          return sortedRoles.map((pr) => pr.role);
        }
        // Si es string[] (formato antiguo), devolverlo directamente
        return player.playerRoles as unknown as string[];
      }
      return [];
    };

    const userSelectedRoles = getUserSelectedRoles();

    // Priorizar el rol asignado si existe, seguido por las elecciones del usuario
    let displayRoles: string[] = [];

    if (player.assignedRole) {
      // Mostrar el rol asignado primero (con fondo amarillo)
      displayRoles.push(player.assignedRole);
      // Agregar las elecciones del usuario que no sean el rol asignado
      const otherUserRoles = userSelectedRoles.filter(
        (role) => role !== player.assignedRole
      );
      displayRoles.push(...otherUserRoles);
    } else {
      // Si no hay rol asignado, mostrar las elecciones del usuario
      displayRoles = userSelectedRoles;
    }

    // Eliminar duplicados manteniendo el orden
    const uniqueRoles = displayRoles.filter(
      (role, index) => displayRoles.indexOf(role) === index
    );

    // Obtener íconos para los roles
    const roleIcons = uniqueRoles.map((role) => ROLE_ICONS[role]?.icon);

    return (
      <li className='py-2 flex items-center justify-between'>
        <div className='flex items-center gap-2 sm:gap-3 flex-grow min-w-0'>
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
          <div className='min-w-0 flex-grow'>
            <div className='flex items-center flex-wrap'>
              <p className='font-medium text-gray-800 text-sm sm:text-base break-words max-w-none leading-tight player-name'>
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

        {currentUserIsAdmin && (
          <div className='flex space-x-1 admin-buttons'>
            {showReplaceButton && onReplaceTbd && (
              <button
                onClick={() => onReplaceTbd(player.id)}
                className='p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors admin-button'
                title='Reemplazar jugador'
              >
                <UserPlusIcon className='h-4 w-4 sm:h-5 sm:w-5' />
              </button>
            )}
            {onSwapPlayer && (
              <button
                onClick={() => onSwapPlayer(player.id, isTeamA)}
                className='p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors admin-button'
                title='Intercambiar jugador entre equipos'
              >
                <ArrowsRightLeftIcon className='h-4 w-4 sm:h-5 sm:w-5' />
              </button>
            )}
          </div>
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
    avgRating,
  }) => {
    // Verificar si este equipo específico tiene promedio de edad
    console.log(`TeamSection "${teamName}" avgAge:`, avgAge);

    // Ordenar los jugadores por rol
    const sortedPlayers = sortPlayersByRole(players);
    const sortedTbdPlayers = sortPlayersByRole(tbdPlayers);

    return (
      <div className='p-3 sm:p-4 w-full'>
        <div className='text-center mb-4'>
          {/* Rating promedio */}
          {avgRating !== undefined && (
            <div className='mb-2'>
              <div className='inline-flex items-center bg-yellow-50 px-2 sm:px-3 py-1 rounded-md'>
                <span className='text-yellow-700 font-medium text-sm sm:text-base'>
                  {avgRating}
                </span>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='currentColor'
                  className='w-4 h-4 sm:w-5 sm:h-5 ml-1 text-yellow-500'
                >
                  <path
                    fillRule='evenodd'
                    d='M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Nombre del equipo */}
          <h3
            className={`text-base sm:text-lg md:text-xl font-bold ${colorClass} mb-1`}
          >
            {teamName}
          </h3>

          {/* Promedio de edad */}
          {avgAge !== undefined ? (
            <p className='text-sm sm:text-base font-medium text-gray-600'>
              Edad promedio: {avgAge} años
            </p>
          ) : (
            <p className='text-xs sm:text-sm text-gray-400'>Edad promedio: —</p>
          )}
        </div>

        <ul className='divide-y divide-gray-100'>
          {/* Regular players */}
          {sortedPlayers.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              showReplaceButton={player.playerType === 'TBD'}
              isTeamA={teamName === teamAName}
            />
          ))}

          {/* TBD players */}
          {sortedTbdPlayers.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              isTbd={true}
              showReplaceButton={true}
              isTeamA={teamName === teamAName}
            />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div
      id={`teams-list-container-${sortCount}`}
      className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible w-full'
      data-sort-count={sortCount}
    >
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
            avgRating={effectiveTeamAAvgRating}
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
            avgRating={effectiveTeamBAvgRating}
          />
        </div>
      </div>
    </div>
  );
};

export default TeamsList;
