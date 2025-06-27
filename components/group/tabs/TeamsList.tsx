import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Avatar } from '@mui/material';
import {
  UserIcon,
  UserPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import {
  PLAYER_ROLES,
  PlayerRole,
  PlayerRoleType,
} from '../../../lib/teambuilder';
import type { Player, TbdPlayer } from '../../../types/match';
import { calculateAge } from '../../../lib/utils';
import { sortPlayersByRole } from '../../../lib/matches/roleUtils';

// Mapeo de roles a iconos y prioridad (para ordenamiento)
const ROLE_ICONS: Record<
  PlayerRoleType,
  { icon: React.ReactElement; priority: number }
> = {
  Arquero: {
    icon: (
      <div title='Arquero' className='text-xs'>
        🧤
      </div>
    ),
    priority: 0,
  },
  Defensor: {
    icon: (
      <div title='Defensor' className='text-xs'>
        🛡️
      </div>
    ),
    priority: 1,
  },
  Mediocampo: {
    icon: (
      <div title='Mediocampo' className='text-xs'>
        ⚽
      </div>
    ),
    priority: 2,
  },
  Delantero: {
    icon: (
      <div title='Delantero' className='text-xs'>
        👟
      </div>
    ),
    priority: 3,
  },
  Comodín: {
    icon: (
      <div title='Comodín' className='text-xs'>
        🔄
      </div>
    ),
    priority: 4,
  },
};

interface TeamsListProps {
  playersA: Player[];
  playersB: Player[];
  tbdPlayersTeamA?: TbdPlayer[];
  tbdPlayersTeamB?: TbdPlayer[];
  teamAName?: string;
  teamBName?: string;
  teamAColor?: string;
  teamBColor?: string;
  currentUserIsAdmin: boolean;
  onSwapPlayer?: (playerId: string, isTeamA: boolean) => void;
  sortCount?: number;
  matchId?: string;
  isCompactView?: boolean;
  isRandomMode?: boolean;
}

interface PlayerItemProps {
  player: Player | TbdPlayer;
  isTbd?: boolean;
  showReplaceButton?: boolean;
  isTeamA: boolean;
  isRandomMode?: boolean;
}

interface TeamCardProps {
  players: Player[];
  tbdPlayers: TbdPlayer[];
  teamName: string;
  isTeamA: boolean;
  teamColor: string;
  currentUserIsAdmin: boolean;
  sortCount: number;
  avgAge?: number;
  avgRating?: number;
  isRandomMode?: boolean;
}

// Funciones de cálculo memoizadas
const calculateLocalAvgAge = (players: Player[]): number | undefined => {
  const playersWithAge = players.filter(
    (player): player is Player & { age: number } =>
      player.age !== undefined && player.age !== null
  );
  if (playersWithAge.length === 0) return undefined;
  const sum = playersWithAge.reduce((acc, player) => acc + player.age, 0);
  return Math.round(sum / playersWithAge.length);
};

const calculateLocalAvgRating = (players: Player[]): number | undefined => {
  const playersWithRating = players.filter(
    (player): player is Player & { starRating: number } =>
      player.starRating !== undefined && player.starRating !== null
  );
  if (playersWithRating.length === 0) return undefined;
  const sum = playersWithRating.reduce(
    (acc, player) => acc + player.starRating,
    0
  );
  return Number((sum / playersWithRating.length).toFixed(1));
};

// Función para obtener el rol principal de un jugador
const getPrimaryRole = (
  playerRoles?: PlayerRole[]
): PlayerRoleType | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0]?.role;
};

// Función para obtener roles del jugador
const getPlayerRoles = (player: Player | TbdPlayer): PlayerRoleType[] => {
  if (player.playerRoles && Array.isArray(player.playerRoles)) {
    return player.playerRoles.map((pr) => pr.role);
  }
  return [];
};

// Función para agrupar jugadores por posición
const groupPlayersByPosition = (players: (Player | TbdPlayer)[]) => {
  const groups: Record<string, (Player | TbdPlayer)[]> = {};

  players.forEach((player) => {
    const role =
      player.assignedRole || getPrimaryRole(player.playerRoles) || 'Comodín';
    if (!groups[role]) {
      groups[role] = [];
    }
    groups[role].push(player);
  });

  return Object.entries(groups).map(([position, players]) => ({
    position,
    players,
  }));
};

// Función para obtener el nombre de la posición
const getPositionName = (position: PlayerRoleType): string => {
  const positionNames: Record<PlayerRoleType, string> = {
    Arquero: 'Arquero',
    Defensor: 'Defensor',
    Mediocampo: 'Mediocampo',
    Delantero: 'Delantero',
    Comodín: 'Comodín',
  };
  return positionNames[position] || position;
};

// Función para generar estilos dinámicos basados en el color del equipo
const getTeamStyles = (color: string) => {
  return {
    backgroundGradient: `linear-gradient(315deg, ${color} 0%, ${color}40 50%, #f8fafc 100%)`,
    borderColor: color,
    textColor: color,
    headerBackground: `${color}20`,
  };
};

// Función para obtener el color de gradiente basado en la posición
const getPositionGradient = (
  position: PlayerRoleType,
  isTeamA: boolean
): string => {
  switch (position) {
    case 'Arquero':
      return 'from-orange-100 to-orange-200 border-orange-300 hover:from-orange-200 hover:to-orange-300 hover:border-orange-400';
    case 'Defensor':
      return 'from-indigo-100 to-indigo-200 border-indigo-300 hover:from-indigo-200 hover:to-indigo-300 hover:border-indigo-400';
    case 'Mediocampo':
      return 'from-cyan-100 to-cyan-200 border-cyan-300 hover:from-cyan-200 hover:to-cyan-300 hover:border-cyan-400';
    case 'Delantero':
      return 'from-rose-100 to-rose-200 border-rose-300 hover:from-rose-200 hover:to-rose-300 hover:border-rose-400';
    case 'Comodín':
    default:
      return 'from-purple-100 to-purple-200 border-purple-300 hover:from-purple-200 hover:to-purple-300 hover:border-purple-400';
  }
};

const TeamsList = React.memo(
  function TeamsList({
    playersA,
    playersB,
    tbdPlayersTeamA = [],
    tbdPlayersTeamB = [],
    teamAName = 'Equipo A',
    teamBName = 'Equipo B',
    teamAColor = '#3B82F6',
    teamBColor = '#EF4444',
    currentUserIsAdmin,
    onSwapPlayer,
    sortCount = 0,
    matchId,
    isCompactView = false,
    isRandomMode = false,
  }: TeamsListProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const sliderRef = useRef<HTMLDivElement>(null);

    // Debug: Verificar props
    console.log('🔍 DEBUG - TeamsList props:', {
      currentUserIsAdmin,
      onSwapPlayerExists: !!onSwapPlayer,
      playersACount: playersA.length,
      playersBCount: playersB.length,
    });

    // Memoizar los equipos procesados
    const processedTeams = useMemo(() => {
      const processPlayers = (players: Player[]): Player[] => {
        if (!Array.isArray(players)) return [];
        return players.map((player) => ({
          ...player,
          assignedRole:
            player.assignedRole || getPrimaryRole(player.playerRoles),
        }));
      };

      const teamA = processPlayers(playersA);
      const teamB = processPlayers(playersB);

      return {
        teamA,
        teamB,
      };
    }, [playersA, playersB]);

    const { teamA, teamB } = processedTeams;

    // Memoizar TBD players
    const teamATbdPlayers = useMemo(
      () => tbdPlayersTeamA || [],
      [tbdPlayersTeamA]
    );
    const teamBTbdPlayers = useMemo(
      () => tbdPlayersTeamB || [],
      [tbdPlayersTeamB]
    );

    // Memoizar promedios
    const teamAAvgAge = useMemo(() => calculateLocalAvgAge(teamA), [teamA]);
    const teamBAvgAge = useMemo(() => calculateLocalAvgAge(teamB), [teamB]);
    const teamAAvgRating = useMemo(
      () => calculateLocalAvgRating(teamA),
      [teamA]
    );
    const teamBAvgRating = useMemo(
      () => calculateLocalAvgRating(teamB),
      [teamB]
    );

    // Debug: Loggear cambios en equipos
    useEffect(() => {
      console.log('🔍 DEBUG - TeamsList equipos actualizados:', {
        teamACount: teamA.length,
        teamBCount: teamB.length,
        teamATbdCount: teamATbdPlayers.length,
        teamBTbdCount: teamBTbdPlayers.length,
        sortCount,
      });
    }, [sortCount, teamA, teamB]);

    // Memoizar los estilos de los equipos para evitar recálculos innecesarios
    const teamAStyles = useMemo(() => getTeamStyles(teamAColor), [teamAColor]);
    const teamBStyles = useMemo(() => getTeamStyles(teamBColor), [teamBColor]);

    // Componente para un jugador individual
    const PlayerItem: React.FC<PlayerItemProps> = ({
      player,
      isTbd = false,
      showReplaceButton = false,
      isTeamA,
      isRandomMode = false,
    }) => {
      const [dropdownOpen, setDropdownOpen] = useState(false);
      const avatarRef = useRef<HTMLButtonElement>(null);
      const dropdownRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            !avatarRef.current?.contains(event.target as Node)
          ) {
            setDropdownOpen(false);
          }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
          document.removeEventListener('mousedown', handleClickOutside);
      }, []);

      const getUserSelectedRoles = (): { role: string; priority: number }[] => {
        if (!player.playerRoles || !Array.isArray(player.playerRoles)) {
          return [];
        }

        return player.playerRoles
          .map((pr) => ({
            role: pr.role,
            priority: pr.priority,
          }))
          .sort((a, b) => a.priority - b.priority);
      };

      const userSelectedRoles = getUserSelectedRoles();
      const displayRoles: {
        role: PlayerRoleType;
        priority: number;
        isAssigned: boolean;
        isForced: boolean;
      }[] = [];

      if (userSelectedRoles.length > 0) {
        // Mostrar todas las posiciones preferidas del jugador
        userSelectedRoles.forEach((roleObj) => {
          displayRoles.push({
            role: roleObj.role as PlayerRoleType,
            priority: roleObj.priority,
            isAssigned: player.assignedRole === roleObj.role,
            isForced:
              player.assignedRole === roleObj.role &&
              (player.positionForced || false),
          });
        });

        // Si el rol asignado no está entre sus preferencias, agregarlo también
        if (
          player.assignedRole &&
          !userSelectedRoles.some((r) => r.role === player.assignedRole)
        ) {
          displayRoles.push({
            role: player.assignedRole,
            priority: 999, // Al final
            isAssigned: true,
            isForced: true,
          });
        }
      } else if (player.assignedRole) {
        // Si no tiene posiciones preferidas, mostrar la asignada
        displayRoles.push({
          role: player.assignedRole,
          priority: 1,
          isAssigned: true,
          isForced: true, // Siempre forzada si no tenía preferencias
        });
      }

      displayRoles.sort((a, b) => a.priority - b.priority);

      const roleDisplayData = displayRoles.map((roleData) => ({
        role: roleData.role,
        icon:
          ROLE_ICONS[roleData.role as keyof typeof ROLE_ICONS]?.icon ||
          ROLE_ICONS['Comodín'].icon,
        isAssigned: roleData.isAssigned,
        isForced: roleData.isForced,
        priority: roleData.priority,
      }));

      // Obtener la posición principal del jugador para el gradiente
      const primaryPosition =
        player.assignedRole || getPrimaryRole(player.playerRoles) || 'Comodín';
      const positionGradient = getPositionGradient(
        primaryPosition as PlayerRoleType,
        isTeamA
      );

      return (
        <div className='relative'>
          <div
            className={`
        flex items-center justify-between h-7 px-2 rounded-xl transition-all duration-200 border-[0.5px] ml-4
        ${
          isTbd
            ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300 hover:from-gray-100 hover:to-gray-200'
            : `bg-gradient-to-r ${positionGradient}`
        }
        hover:shadow-sm
      `}
          >
            {/* Avatar a la izquierda - posicionado fuera del recuadro */}
            <div className='flex-shrink-0 -ml-6'>
              <button
                ref={avatarRef}
                className='relative'
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <Avatar
                  src={player.avatar || undefined}
                  alt={player.name || 'Jugador'}
                  className='w-6 h-6 border-2 border-white shadow-sm'
                >
                  {player.name ? (
                    <UserIcon className='w-3 h-3 text-gray-500' />
                  ) : (
                    <UserPlusIcon className='w-3 h-3 text-gray-400' />
                  )}
                </Avatar>
              </button>
            </div>

            {/* Player Info - Centered */}
            <div className='min-w-0 flex-grow flex items-center gap-2'>
              <div className='min-w-0 flex-grow'>
                <div className='flex items-center justify-between w-full py-1'>
                  <span className='text-base font-medium text-gray-800 truncate'>
                    {player.name}
                  </span>
                </div>
              </div>

              {/* Role icons and star rating */}
              {!isTbd && (
                <div className='flex items-center gap-1'>
                  {/* Star Rating */}
                  {player.starRating !== undefined &&
                    player.starRating !== null && (
                      <div className='text-xs font-medium text-gray-600 whitespace-nowrap leading-none'>
                        {player.starRating} ⭐
                      </div>
                    )}

                  {/* Role icons - solo mostrar si NO está en modo aleatorio */}
                  {!isRandomMode &&
                    roleDisplayData.map((roleData, index) => (
                      <span
                        key={index}
                        className={`flex-shrink-0 relative ${
                          roleData.isAssigned
                            ? roleData.isForced
                              ? 'bg-red-100 p-0.5 rounded border border-red-300' // Asignado forzado (rojo)
                              : 'bg-lime-100 p-0.5 rounded border border-lime-300' // Asignado natural (verde)
                            : roleData.priority === 1
                            ? 'bg-primary-50 p-0.5 rounded border border-primary-200' // Preferencia primaria
                            : 'bg-gray-50 p-0.5 rounded border border-gray-200' // Preferencia secundaria
                        }`}
                        title={`${roleData.role} ${
                          roleData.isAssigned
                            ? roleData.isForced
                              ? '(Asignado - Forzado)'
                              : '(Asignado - Natural)'
                            : roleData.priority === 1
                            ? '(Preferencia primaria)'
                            : '(Preferencia secundaria)'
                        }`}
                      >
                        {roleData.icon}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Dropdown menu */}
            {dropdownOpen && currentUserIsAdmin && onSwapPlayer && (
              <div
                ref={dropdownRef}
                className='absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50'
              >
                <button
                  onClick={() => {
                    onSwapPlayer(player.id, isTeamA);
                    setDropdownOpen(false);
                  }}
                  className='w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center'
                >
                  <svg
                    className='w-4 h-4 mr-2'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
                    />
                  </svg>
                  Cambiar equipo
                </button>
              </div>
            )}
          </div>
        </div>
      );
    };

    // Componente para una tarjeta de equipo
    const TeamCard = React.memo(
      function TeamCard({
        players,
        tbdPlayers,
        teamName,
        isTeamA,
        teamColor,
        currentUserIsAdmin,
        sortCount,
        isRandomMode = false,
      }: TeamCardProps) {
        const teamStyles = getTeamStyles(teamColor);

        // Memoizar cálculos costosos
        const stats = useMemo(
          () => ({
            avgAge: calculateLocalAvgAge(players),
            avgRating: calculateLocalAvgRating(players),
            playersCount: players.length,
            tbdPlayersCount: tbdPlayers.length,
          }),
          [players, tbdPlayers]
        );

        // Memoizar los jugadores ordenados
        const sortedPlayers = useMemo(
          () => sortPlayersByRole(players),
          [players]
        );

        // Memoizar el agrupamiento de jugadores
        const groupedPlayers = useMemo(
          () => groupPlayersByPosition(sortedPlayers),
          [sortedPlayers]
        );

        // Solo loggear cuando realmente hay cambios
        useEffect(() => {
          console.log('🎯 TeamCard renderizado:', {
            teamName,
            playersCount: stats.playersCount,
            tbdPlayersCount: stats.tbdPlayersCount,
            avgAge: stats.avgAge,
            avgRating: stats.avgRating,
          });
        }, [teamName, stats]);

        return (
          <div
            className='bg-white rounded-2xl shadow-xl p-2 w-full'
            style={{
              background: teamStyles.backgroundGradient,
              borderColor: teamStyles.borderColor,
            }}
          >
            <div className='mb-3'>
              <div className='flex justify-between items-center mb-2'>
                <h3
                  className='text-lg font-bold'
                  style={{ color: teamStyles.textColor }}
                >
                  {teamName}
                </h3>
                <div className='flex space-x-4 text-sm text-gray-700 font-medium'>
                  {stats.avgAge && (
                    <span title='Edad promedio'>
                      👥 {stats.avgAge.toFixed(1)}
                    </span>
                  )}
                  {stats.avgRating && (
                    <span title='Rating promedio'>
                      ⭐ {stats.avgRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de jugadores agrupados por posición */}
            <div className='space-y-1'>
              {isRandomMode ? (
                // Modo aleatorio: mostrar jugadores sin agrupar por posición
                <div className='space-y-1'>
                  {sortedPlayers.map((player) => (
                    <PlayerItem
                      key={player.id}
                      player={player}
                      showReplaceButton={player.playerType === 'TBD'}
                      isTbd={tbdPlayers.some((tbd) => tbd.id === player.id)}
                      isTeamA={isTeamA}
                      isRandomMode={isRandomMode}
                    />
                  ))}
                </div>
              ) : (
                // Modo normal: mostrar jugadores con líneas divisorias entre posiciones
                <div className='space-y-1'>
                  {sortedPlayers.map((player, index) => {
                    const currentPosition =
                      player.assignedRole ||
                      getPrimaryRole(player.playerRoles) ||
                      'Comodín';
                    const nextPlayer = sortedPlayers[index + 1];
                    const nextPosition = nextPlayer
                      ? nextPlayer.assignedRole ||
                        getPrimaryRole(nextPlayer.playerRoles) ||
                        'Comodín'
                      : null;
                    const showDivider =
                      nextPosition && currentPosition !== nextPosition;

                    return (
                      <div key={player.id}>
                        <PlayerItem
                          player={player}
                          showReplaceButton={player.playerType === 'TBD'}
                          isTbd={tbdPlayers.some((tbd) => tbd.id === player.id)}
                          isTeamA={isTeamA}
                          isRandomMode={isRandomMode}
                        />
                        {showDivider && (
                          <div className='flex justify-center py-0.5'>
                            <div className='w-full h-px bg-gray-300 mx-4'></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      },
      (prevProps, nextProps) => {
        // Custom comparison function para evitar re-renders innecesarios
        return (
          prevProps.players === nextProps.players &&
          prevProps.tbdPlayers === nextProps.tbdPlayers &&
          prevProps.teamName === nextProps.teamName &&
          prevProps.isTeamA === nextProps.isTeamA &&
          prevProps.teamColor === nextProps.teamColor &&
          prevProps.sortCount === nextProps.sortCount &&
          prevProps.isRandomMode === nextProps.isRandomMode
        );
      }
    );

    TeamCard.displayName = 'TeamCard';

    // Función para obtener el símbolo de rol
    const getRoleSymbol = (
      playerRoles?: PlayerRole[],
      assignedRole?: string
    ): string => {
      const role = assignedRole || getPrimaryRole(playerRoles);

      if (!role) return 'JUG';

      switch (role) {
        case 'Arquero':
          return 'ARQ';
        case 'Defensor':
          return 'DEF';
        case 'Mediocampo':
          return 'MED';
        case 'Delantero':
          return 'DEL';
        case 'Comodín':
          return 'COM';
        default:
          return 'JUG';
      }
    };

    // Función para obtener solo el apellido
    const getLastName = (fullName: string): string => {
      if (!fullName) return 'Sin nombre';
      const nameParts = fullName.trim().split(' ');
      return nameParts[nameParts.length - 1];
    };

    // Función para formatear nombre (iniciales + apellido si es muy largo)
    const formatPlayerName = (fullName: string): string => {
      if (!fullName) return 'Sin nombre';

      const nameParts = fullName.trim().split(' ');

      // Si solo tiene un nombre, devolverlo tal como está
      if (nameParts.length === 1) {
        return nameParts[0];
      }

      // Si el nombre completo es corto (menos de 12 caracteres), usar apellido solo
      if (fullName.length <= 12) {
        return getLastName(fullName);
      }

      // Si es muy largo, usar iniciales + apellido
      const lastName = nameParts[nameParts.length - 1];
      const firstNames = nameParts.slice(0, -1);
      const initials = firstNames
        .map((name) => name.charAt(0).toUpperCase())
        .join('.');

      return `${initials}. ${lastName}`;
    };

    // Componente para vista compacta
    const CompactView = () => {
      const allPlayersA = [...teamA, ...teamATbdPlayers];
      const allPlayersB = [...teamB, ...teamBTbdPlayers];
      const sortedPlayersA = sortPlayersByRole(allPlayersA);
      const sortedPlayersB = sortPlayersByRole(allPlayersB);

      // Determinar el número máximo de jugadores para emparejar líneas
      const maxPlayers = Math.max(sortedPlayersA.length, sortedPlayersB.length);

      return (
        <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mx-auto max-w-5xl'>
          {/* Header con nombres de equipos y promedios */}
          <div className='flex justify-between items-center mb-1'>
            <div className='text-center flex-1'>
              <div className='flex items-center justify-center gap-2'>
                <h3 className='text-lg font-bold text-primary-900'>
                  {teamAName}
                </h3>
                <div className='text-xs text-gray-600'>
                  {teamAAvgAge && `${teamAAvgAge}🎂`}
                  {teamAAvgAge && teamAAvgRating && '•'}
                  {teamAAvgRating && `${teamAAvgRating}⭐`}
                </div>
              </div>
            </div>

            <div className='text-center flex-1'>
              <div className='flex items-center justify-center gap-2'>
                <h3 className='text-lg font-bold text-lime-900'>{teamBName}</h3>
                <div className='text-xs text-gray-600'>
                  {teamBAvgAge && `${teamBAvgAge}🎂`}
                  {teamBAvgAge && teamBAvgRating && '•'}
                  {teamBAvgRating && `${teamBAvgRating}⭐`}
                </div>
              </div>
            </div>
          </div>

          {/* Lista de jugadores emparejados */}
          <div className='space-y-1'>
            {Array.from({ length: maxPlayers }, (_, index) => {
              const playerA = sortedPlayersA[index];
              const playerB = sortedPlayersB[index];

              // Preparar textos - sin prefijo TBD para fantasmas
              const textA = playerA
                ? `(${getRoleSymbol(
                    playerA.playerRoles,
                    playerA.assignedRole
                  )}) ${formatPlayerName(playerA.name || '')}`
                : '—';

              const textB = playerB
                ? `${formatPlayerName(playerB.name || '')} (${getRoleSymbol(
                    playerB.playerRoles,
                    playerB.assignedRole
                  )})`
                : '—';

              return (
                <div
                  key={index}
                  className='grid grid-cols-12 items-center gap-2 min-h-[1.25rem]'
                >
                  {/* Jugador Equipo A - ocupa 5 columnas */}
                  <div className='col-span-5 text-right'>
                    <span className='text-gray-800 font-medium text-xs truncate block'>
                      {textA}
                    </span>
                  </div>

                  {/* Separador fijo - ocupa 2 columnas */}
                  <div className='col-span-2 flex justify-center'>
                    <div className='text-gray-400 text-xs font-light'>|</div>
                  </div>

                  {/* Jugador Equipo B - ocupa 5 columnas */}
                  <div className='col-span-5 text-left'>
                    <span className='text-gray-800 font-medium text-xs truncate block'>
                      {textB}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div
        id={`teams-list-container-${sortCount}`}
        className='w-full bg-transparent'
        data-sort-count={sortCount}
      >
        {isCompactView ? (
          <CompactView />
        ) : (
          <>
            {/* Desktop Layout with better spacing */}
            <div className='hidden md:flex gap-6 justify-center px-4'>
              <TeamCard
                players={teamA}
                tbdPlayers={teamATbdPlayers}
                teamName={teamAName || 'Equipo A'}
                isTeamA={true}
                teamColor={teamAColor}
                currentUserIsAdmin={currentUserIsAdmin}
                sortCount={sortCount}
                isRandomMode={isRandomMode}
              />
              <TeamCard
                players={teamB}
                tbdPlayers={teamBTbdPlayers}
                teamName={teamBName || 'Equipo B'}
                isTeamA={false}
                teamColor={teamBColor}
                currentUserIsAdmin={currentUserIsAdmin}
                sortCount={sortCount}
                isRandomMode={isRandomMode}
              />
            </div>

            {/* Mobile Slider Layout with better spacing */}
            <div className='md:hidden'>
              {/* Navigation dots */}
              <div className='flex justify-center mb-4'>
                <div className='flex space-x-2'>
                  <button
                    onClick={() => setCurrentSlide(0)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      currentSlide === 0
                        ? 'bg-primary-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                  <button
                    onClick={() => setCurrentSlide(1)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      currentSlide === 1
                        ? 'bg-primary-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                </div>
              </div>

              <div
                ref={sliderRef}
                className='flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-4 px-4'
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className='snap-center min-w-[300px] flex-shrink-0'>
                  <TeamCard
                    players={teamA}
                    tbdPlayers={teamATbdPlayers}
                    teamName={teamAName || 'Equipo A'}
                    isTeamA={true}
                    teamColor={teamAColor}
                    currentUserIsAdmin={currentUserIsAdmin}
                    sortCount={sortCount}
                    isRandomMode={isRandomMode}
                  />
                </div>
                <div className='snap-center min-w-[300px] flex-shrink-0'>
                  <TeamCard
                    players={teamB}
                    tbdPlayers={teamBTbdPlayers}
                    teamName={teamBName || 'Equipo B'}
                    isTeamA={false}
                    teamColor={teamBColor}
                    currentUserIsAdmin={currentUserIsAdmin}
                    sortCount={sortCount}
                    isRandomMode={isRandomMode}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function para evitar re-renders innecesarios
    return (
      prevProps.playersA === nextProps.playersA &&
      prevProps.playersB === nextProps.playersB &&
      prevProps.tbdPlayersTeamA === nextProps.tbdPlayersTeamA &&
      prevProps.tbdPlayersTeamB === nextProps.tbdPlayersTeamB &&
      prevProps.teamAName === nextProps.teamAName &&
      prevProps.teamBName === nextProps.teamBName &&
      prevProps.teamAColor === nextProps.teamAColor &&
      prevProps.teamBColor === nextProps.teamBColor &&
      prevProps.currentUserIsAdmin === nextProps.currentUserIsAdmin &&
      prevProps.sortCount === nextProps.sortCount &&
      prevProps.isRandomMode === nextProps.isRandomMode &&
      prevProps.isCompactView === nextProps.isCompactView
    );
  }
);

TeamsList.displayName = 'TeamsList';

export default TeamsList;
