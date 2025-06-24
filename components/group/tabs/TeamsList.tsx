import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Avatar } from '@mui/material';
import {
  UserIcon,
  UserPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  PLAYER_ROLES,
  PlayerRole,
  PlayerRoleType,
} from '../../../lib/teambuilder';
import type { Player, TbdPlayer } from '../../../types/match';

// Mapeo de roles a iconos y prioridad (para ordenamiento)
const ROLE_ICONS: Record<
  PlayerRoleType,
  { icon: React.ReactElement; priority: number }
> = {
  Arquero: {
    icon: (
      <div title='Arquero' className='text-sm'>
        🧤
      </div>
    ),
    priority: 0,
  },
  Defensor: {
    icon: (
      <div title='Defensor' className='text-sm'>
        🛡️
      </div>
    ),
    priority: 1,
  },
  Mediocampo: {
    icon: (
      <div title='Mediocampo' className='text-sm'>
        ⚽
      </div>
    ),
    priority: 2,
  },
  Delantero: {
    icon: (
      <div title='Delantero' className='text-sm'>
        👟
      </div>
    ),
    priority: 3,
  },
  Comodín: {
    icon: (
      <div title='Comodín' className='text-sm'>
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
  currentUserIsAdmin: boolean;
  onSwapPlayer?: (playerId: string, isTeamA: boolean) => void;
  sortCount?: number;
  matchId?: string;
  isCompactView?: boolean;
}

interface PlayerItemProps {
  player: Player | TbdPlayer;
  isTbd?: boolean;
  showReplaceButton?: boolean;
  isTeamA: boolean;
}

interface TeamCardProps {
  players: Player[];
  tbdPlayers: TbdPlayer[];
  teamName: string;
  isTeamA: boolean;
  avgAge?: number;
  avgRating?: number;
}

// Función para obtener el rol principal de un jugador
const getPrimaryRole = (
  playerRoles?: PlayerRole[]
): PlayerRoleType | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;
  const sortedRoles = [...playerRoles].sort((a, b) => a.priority - b.priority);
  return sortedRoles[0].role;
};

// Función para obtener roles del jugador
const getPlayerRoles = (player: Player | TbdPlayer): PlayerRoleType[] => {
  if (player.playerRoles && Array.isArray(player.playerRoles)) {
    return player.playerRoles.map((pr) => pr.role);
  }
  return [];
};

// Función para ordenar jugadores por rol
const sortPlayersByRole = (
  players: (Player | TbdPlayer)[]
): (Player | TbdPlayer)[] => {
  return [...players].sort((a, b) => {
    const roleA = getPrimaryRole(a.playerRoles) || a.assignedRole;
    const roleB = getPrimaryRole(b.playerRoles) || b.assignedRole;

    if (!roleA && !roleB) return 0;
    if (!roleA) return 1;
    if (!roleB) return -1;

    // Asegurarse que los roles sean válidos antes de usarlos como índices
    const validRoleA = roleA as PlayerRoleType;
    const validRoleB = roleB as PlayerRoleType;

    const priorityA = ROLE_ICONS[validRoleA]?.priority ?? 999;
    const priorityB = ROLE_ICONS[validRoleB]?.priority ?? 999;

    return priorityA - priorityB;
  });
};

const TeamsList: React.FC<TeamsListProps> = ({
  playersA,
  playersB,
  tbdPlayersTeamA = [],
  tbdPlayersTeamB = [],
  teamAName = 'Equipo A',
  teamBName = 'Equipo B',
  currentUserIsAdmin,
  onSwapPlayer,
  sortCount = 0,
  matchId,
  isCompactView = false,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Procesar jugadores con useMemo para evitar re-renders innecesarios
  const processedTeams = useMemo(() => {
    const processPlayers = (players: Player[]): Player[] => {
      if (!Array.isArray(players)) return [];
      return players.map((player) => ({
        ...player,
        assignedRole: player.assignedRole || getPrimaryRole(player.playerRoles),
      }));
    };

    const teamA = processPlayers(playersA);
    const teamB = processPlayers(playersB);

    // Verificar que todos los jugadores tengan un rol asignado
    const allPlayersHaveRoles = [...teamA, ...teamB].every(
      (player) => player.assignedRole
    );

    // Verificar que los equipos estén balanceados (diferencia máxima de 1 jugador)
    const isBalanced = Math.abs(teamA.length - teamB.length) <= 1;

    console.log('🎯 TeamsList renderizado:', {
      teamALength: teamA.length,
      teamBLength: teamB.length,
      teamAName,
      teamBName,
      sortCount,
      allPlayersHaveRoles,
      isBalanced,
    });

    return {
      teamA,
      teamB,
      allPlayersHaveRoles,
      isBalanced,
    };
  }, [playersA, playersB, sortCount]);

  const { teamA, teamB, allPlayersHaveRoles, isBalanced } = processedTeams;

  // Si hay un desbalance o jugadores sin rol, mostrar advertencia
  if (!allPlayersHaveRoles || !isBalanced) {
    console.warn(
      '⚠️ Advertencia: Equipos no están correctamente balanceados o hay jugadores sin rol asignado'
    );
  }

  // Calcular promedios localmente si no vienen en props
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

  const teamAAvgAge = calculateLocalAvgAge(teamA);
  const teamBAvgAge = calculateLocalAvgAge(teamB);
  const teamAAvgRating = calculateLocalAvgRating(teamA);
  const teamBAvgRating = calculateLocalAvgRating(teamB);

  // Filtrar TBD players por equipo
  const teamATbdPlayers = tbdPlayersTeamA || [];
  const teamBTbdPlayers = tbdPlayersTeamB || [];

  // Navigation functions for mobile slider
  const nextSlide = () => {
    setCurrentSlide(1);
    if (sliderRef.current) {
      sliderRef.current.scrollTo({
        left: sliderRef.current.offsetWidth,
        behavior: 'smooth',
      });
    }
  };

  const prevSlide = () => {
    setCurrentSlide(0);
    if (sliderRef.current) {
      sliderRef.current.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  };

  // Handle scroll to update current slide
  useEffect(() => {
    const handleScroll = () => {
      if (!sliderRef.current) return;
      const scrollLeft = sliderRef.current.scrollLeft;
      const slideWidth = sliderRef.current.offsetWidth;
      const newSlide = Math.round(scrollLeft / slideWidth);
      setCurrentSlide(newSlide);
    };

    const currentSlider = sliderRef.current;
    if (currentSlider) {
      currentSlider.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (currentSlider) {
        currentSlider.removeEventListener('scroll', handleScroll);
      }
    };
  }, [sortCount, teamA, teamB]);

  // Componente para un jugador individual
  const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    isTbd = false,
    showReplaceButton = false,
    isTeamA,
  }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({
      top: 0,
      left: 0,
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLButtonElement>(null);

    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setDropdownOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const getUserSelectedRoles = (): { role: string; priority: number }[] => {
      if (!player.playerRoles || !Array.isArray(player.playerRoles)) {
        return [];
      }

      // Si el array está vacío, retornar array vacío
      if (player.playerRoles.length === 0) {
        return [];
      }

      // Si es un array de objetos PlayerRole
      if (
        typeof player.playerRoles[0] === 'object' &&
        'role' in player.playerRoles[0]
      ) {
        return [...(player.playerRoles as PlayerRole[])].sort(
          (a, b) => a.priority - b.priority
        );
      }

      // Si es un array de strings (formato antiguo)
      if (typeof player.playerRoles[0] === 'string') {
        return (player.playerRoles as unknown as string[]).map(
          (role, index) => ({
            role,
            priority: index + 1,
          })
        );
      }

      // Si no es ninguno de los formatos esperados, retornar array vacío
      return [];
    };

    const userSelectedRoles = getUserSelectedRoles();

    let displayRoles: {
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

    return (
      <div className='relative'>
        <div
          className={`
          flex items-center justify-between py-0.5 px-3 pl-8 rounded-xl transition-all duration-200 border-[0.5px]
          ${
            isTbd
              ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300 hover:from-gray-100 hover:to-gray-200'
              : isTeamA
              ? 'bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200 hover:from-primary-100 hover:to-primary-200 hover:border-primary-300'
              : 'bg-gradient-to-r from-lime-50 to-lime-100 border-lime-200 hover:from-lime-100 hover:to-lime-200 hover:border-lime-300'
          }
          hover:shadow-md
        `}
        >
          {/* Player Info - Centered vertically */}
          <div className='min-w-0 flex-grow flex items-center justify-between'>
            <div className='min-w-0 flex-grow'>
              <div className='flex items-center gap-1'>
                <p className='font-medium text-gray-900 text-sm truncate'>
                  {player.name || (isTbd ? 'TBD' : 'Jugador sin nombre')}
                  {player.age && !isTbd && (
                    <span className='text-gray-400 font-normal ml-1'>
                      ({player.age})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Role icons and star rating on the right */}
            {!isTbd && (
              <div className='flex items-center gap-1 ml-3'>
                {/* Star Rating */}
                {player.starRating !== undefined &&
                  player.starRating !== null && (
                    <div className='bg-white px-1.5 py-0.5 rounded-full text-[9px] font-medium text-gray-600 whitespace-nowrap shadow-sm border border-gray-200'>
                      {player.starRating} ⭐
                    </div>
                  )}

                {/* Role icons */}
                {roleDisplayData.map((roleData, index) => (
                  <span
                    key={index}
                    className={`flex-shrink-0 relative ${
                      roleData.isAssigned
                        ? roleData.isForced
                          ? 'bg-red-100 p-1 rounded border border-red-300' // Asignado forzado (rojo)
                          : 'bg-lime-100 p-1 rounded border border-lime-300' // Asignado natural (verde)
                        : roleData.priority === 1
                        ? 'bg-primary-50 p-1 rounded border border-primary-200' // Preferencia primaria
                        : 'bg-gray-50 p-1 rounded border border-gray-200' // Preferencia secundaria
                    }`}
                    title={`${roleData.role} ${
                      roleData.isAssigned
                        ? roleData.isForced
                          ? '(Asignado - Forzado)'
                          : '(Asignado - Natural)'
                        : roleData.priority === 1
                        ? '(Preferencia Primaria)'
                        : '(Preferencia Secundaria)'
                    }`}
                  >
                    {roleData.icon}
                    {/* Indicator for forced assignments */}
                    {roleData.isAssigned && roleData.isForced && (
                      <div
                        className='absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full'
                        title='Posición forzada'
                      />
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Admin button */}
          {currentUserIsAdmin && showReplaceButton && onSwapPlayer && (
            <button
              onClick={() => onSwapPlayer(player.id, isTeamA)}
              className='p-2 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 transition-colors ml-3'
              title='Reemplazar jugador'
            >
              <UserPlusIcon className='h-4 w-4' />
            </button>
          )}
        </div>

        {/* Avatar protruding from left border */}
        <div
          className='absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-30'
          ref={dropdownRef}
        >
          <button
            ref={avatarRef}
            onClick={() => {
              if (currentUserIsAdmin && onSwapPlayer && !isTbd) {
                // Calcular posición del dropdown
                if (avatarRef.current) {
                  const rect = avatarRef.current.getBoundingClientRect();
                  setDropdownPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                  });
                }
                setDropdownOpen(!dropdownOpen);
              }
            }}
            className={`relative z-0 ${
              currentUserIsAdmin && onSwapPlayer && !isTbd
                ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all transform hover:scale-110'
                : 'cursor-default'
            }`}
            disabled={!currentUserIsAdmin || !onSwapPlayer || isTbd}
          >
            {isTbd ? (
              <div className='h-10 w-10 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center shadow-sm'>
                <UserIcon className='h-5 w-5 text-gray-400' />
              </div>
            ) : (
              <Avatar
                src={player.avatar || ''}
                alt={player.name || 'Jugador'}
                className='h-10 w-10 rounded-full border-2 border-white shadow-md'
              />
            )}
          </button>

          {/* Star Rating below avatar */}
          {/* Moved to right side with role icons */}

          {/* Dropdown Menu */}
          {dropdownOpen && currentUserIsAdmin && onSwapPlayer && !isTbd && (
            <div
              className='fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[999999]'
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
              <button
                onClick={() => {
                  onSwapPlayer(player.id, isTeamA);
                  setDropdownOpen(false);
                }}
                className='flex items-center w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors'
              >
                <svg
                  className='w-4 h-4 mr-2 text-gray-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
                  />
                </svg>
                Intercambiar de equipo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Función para agrupar jugadores por posición
  const groupPlayersByPosition = (players: (Player | TbdPlayer)[]) => {
    const groups: { [key: string]: (Player | TbdPlayer)[] } = {};

    players.forEach((player) => {
      const role = player.assignedRole || 'Sin posición';
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(player);
    });

    // Ordenar grupos por prioridad de posición
    const orderedPositions = [
      PLAYER_ROLES.GOALKEEPER,
      PLAYER_ROLES.DEFENDER,
      PLAYER_ROLES.MIDFIELDER,
      PLAYER_ROLES.FORWARD,
      PLAYER_ROLES.WILDCARD,
      'Sin posición',
    ];

    const orderedGroups: {
      position: string;
      players: (Player | TbdPlayer)[];
    }[] = [];

    orderedPositions.forEach((position) => {
      if (groups[position] && groups[position].length > 0) {
        orderedGroups.push({
          position,
          players: groups[position],
        });
      }
    });

    return orderedGroups;
  };

  // Función para obtener el nombre en español de la posición
  const getPositionName = (position: PlayerRoleType): string => {
    switch (position) {
      case 'Arquero':
        return 'Arquero';
      case 'Defensor':
        return 'Defensor';
      case 'Mediocampo':
        return 'Mediocampo';
      case 'Delantero':
        return 'Delantero';
      case 'Comodín':
        return 'Comodín';
      default:
        return position;
    }
  };

  // Componente para una tarjeta de equipo
  const TeamCard: React.FC<TeamCardProps> = ({
    players,
    tbdPlayers,
    teamName,
    isTeamA,
    avgAge,
    avgRating,
  }) => {
    const sortedPlayers = useMemo(() => sortPlayersByRole(players), [players]);
    const groupedPlayers = useMemo(
      () => groupPlayersByPosition(sortedPlayers),
      [sortedPlayers]
    );

    console.log('🎯 TeamCard renderizado:', {
      teamName,
      playersCount: players.length,
      tbdPlayersCount: tbdPlayers.length,
      avgAge,
      avgRating,
    });

    return (
      <div
        className={`bg-white rounded-lg shadow-md p-4 w-full ${
          isTeamA ? 'border-primary-200' : 'border-lime-200'
        } border`}
      >
        <div className='flex justify-between items-center mb-4'>
          <h3
            className={`text-lg font-semibold ${
              isTeamA ? 'text-primary-800' : 'text-lime-800'
            }`}
          >
            {teamName}
          </h3>
          <div className='flex space-x-2 text-sm text-gray-600'>
            {avgAge && (
              <span title='Edad promedio'>👥 {avgAge.toFixed(1)}</span>
            )}
            {avgRating && (
              <span title='Rating promedio'>⭐ {avgRating.toFixed(1)}</span>
            )}
          </div>
        </div>

        {/* Lista de jugadores agrupados por posición */}
        <div className='space-y-3'>
          {groupedPlayers.map((group) => (
            <div key={group.position} className='relative'>
              {/* Encabezado de posición */}
              <div className='flex items-center gap-2 mb-2'>
                <div className='flex-grow h-px bg-gray-200'></div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    isTeamA
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'bg-lime-50 text-lime-700 border border-lime-200'
                  }`}
                >
                  {getPositionName(group.position as PlayerRoleType)}
                </span>
                <div className='flex-grow h-px bg-gray-200'></div>
              </div>

              {/* Jugadores en esta posición */}
              <div className='space-y-2'>
                {group.players.map((player) => (
                  <PlayerItem
                    key={player.id}
                    player={player}
                    showReplaceButton={player.playerType === 'TBD'}
                    isTbd={tbdPlayers.some((tbd) => tbd.id === player.id)}
                    isTeamA={isTeamA}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Función para obtener el símbolo de rol
  const getRoleSymbol = (
    playerRoles?: PlayerRole[],
    assignedRole?: string
  ): string => {
    const role = assignedRole || getPrimaryRole(playerRoles);

    if (!role) return 'JUG';

    switch (role) {
      case PLAYER_ROLES.GOALKEEPER:
        return 'POR';
      case PLAYER_ROLES.DEFENDER:
        return 'DEF';
      case PLAYER_ROLES.MIDFIELDER:
        return 'MED';
      case PLAYER_ROLES.FORWARD:
        return 'DEL';
      case PLAYER_ROLES.WILDCARD:
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
      <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mx-auto max-w-5xl'>
        {/* Header con nombres de equipos y promedios */}
        <div className='flex justify-between items-center mb-6'>
          <div className='text-center flex-1'>
            <h3 className='text-xl font-bold text-primary-900 mb-1'>
              {teamAName}
            </h3>
            <div className='text-sm text-gray-600'>
              {teamAAvgAge && `${teamAAvgAge} 🎂`}
              {teamAAvgAge && teamAAvgRating && ' • '}
              {teamAAvgRating && `${teamAAvgRating} ⭐`}
            </div>
          </div>

          <div className='text-center flex-1'>
            <h3 className='text-xl font-bold text-lime-900 mb-1'>
              {teamBName}
            </h3>
            <div className='text-sm text-gray-600'>
              {teamBAvgAge && `${teamBAvgAge} 🎂`}
              {teamBAvgAge && teamBAvgRating && ' • '}
              {teamBAvgRating && `${teamBAvgRating} ⭐`}
            </div>
          </div>
        </div>

        {/* Lista de jugadores emparejados */}
        <div className='space-y-2'>
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
                className='grid grid-cols-12 items-center gap-2 min-h-[1.5rem]'
              >
                {/* Jugador Equipo A - ocupa 5 columnas */}
                <div className='col-span-5 text-right'>
                  <span className='text-gray-800 font-medium text-xs sm:text-sm md:text-base lg:text-lg truncate block'>
                    {textA}
                  </span>
                </div>

                {/* Separador fijo - ocupa 2 columnas */}
                <div className='col-span-2 flex justify-center'>
                  <div className='text-gray-400 text-sm sm:text-base md:text-lg font-light'>
                    |
                  </div>
                </div>

                {/* Jugador Equipo B - ocupa 5 columnas */}
                <div className='col-span-5 text-left'>
                  <span className='text-gray-800 font-medium text-xs sm:text-sm md:text-base lg:text-lg truncate block'>
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
              avgAge={teamAAvgAge}
              avgRating={teamAAvgRating}
            />
            <TeamCard
              players={teamB}
              tbdPlayers={teamBTbdPlayers}
              teamName={teamBName || 'Equipo B'}
              isTeamA={false}
              avgAge={teamBAvgAge}
              avgRating={teamBAvgRating}
            />
          </div>

          {/* Mobile Slider Layout with better spacing */}
          <div className='md:hidden'>
            {/* Navigation Controls - Moved to top */}
            <div className='flex justify-center items-center gap-3 mb-4'>
              <button
                onClick={prevSlide}
                className={`p-2 rounded-lg transition-colors ${
                  currentSlide === 0
                    ? 'bg-primary-100 text-primary-400 cursor-not-allowed'
                    : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                }`}
                disabled={currentSlide === 0}
              >
                <ChevronLeftIcon className='h-4 w-4' />
              </button>

              {/* Dots indicator */}
              <div className='flex gap-1.5'>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentSlide === 0 ? 'bg-primary-800' : 'bg-primary-300'
                  }`}
                />
                <div
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentSlide === 1 ? 'bg-primary-800' : 'bg-primary-300'
                  }`}
                />
              </div>

              <button
                onClick={nextSlide}
                className={`p-2 rounded-lg transition-colors ${
                  currentSlide === 1
                    ? 'bg-primary-100 text-primary-400 cursor-not-allowed'
                    : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                }`}
                disabled={currentSlide === 1}
              >
                <ChevronRightIcon className='h-4 w-4' />
              </button>
            </div>

            {/* Slider Container */}
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
                  avgAge={teamAAvgAge}
                  avgRating={teamAAvgRating}
                />
              </div>
              <div className='snap-center min-w-[300px] flex-shrink-0'>
                <TeamCard
                  players={teamB}
                  tbdPlayers={teamBTbdPlayers}
                  teamName={teamBName || 'Equipo B'}
                  isTeamA={false}
                  avgAge={teamBAvgAge}
                  avgRating={teamBAvgRating}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamsList;
