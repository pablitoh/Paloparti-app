import React, { useState, useRef, useEffect } from 'react';
import { Avatar } from '@mui/material';
import {
  UserIcon,
  UserPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { PLAYER_ROLES, PlayerRole } from '../../../lib/teambuilder/constants';

// Mapeo de roles a iconos y prioridad (para ordenamiento)
const ROLE_ICONS: Record<
  string,
  { icon: React.ReactElement; priority: number }
> = {
  [PLAYER_ROLES.GOALKEEPER]: {
    icon: (
      <div title='Arquero' className='text-sm'>
        🧤
      </div>
    ),
    priority: 0,
  },
  [PLAYER_ROLES.DEFENDER]: {
    icon: (
      <div title='Defensor' className='text-sm'>
        🛡️
      </div>
    ),
    priority: 1,
  },
  [PLAYER_ROLES.MIDFIELDER]: {
    icon: (
      <div title='Mediocampo' className='text-sm'>
        ⚽
      </div>
    ),
    priority: 2,
  },
  [PLAYER_ROLES.FORWARD]: {
    icon: (
      <div title='Delantero' className='text-sm'>
        👟
      </div>
    ),
    priority: 3,
  },
  [PLAYER_ROLES.WILDCARD]: {
    icon: (
      <div title='Comodín' className='text-sm'>
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
  playerRoles?: PlayerRole[];
  assignedRole?: string;
  age?: number;
  starRating?: number;
}

interface TbdPlayer {
  id: string;
  name: string;
  isTeamA: boolean;
  avatar?: string | null;
  playerType?: string;
  playerRoles?: PlayerRole[];
  assignedRole?: string;
  age?: number;
  starRating?: number;
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
  teamAAvgAge?: number;
  teamBAvgAge?: number;
  teamAAvgRating?: number;
  teamBAvgRating?: number;
  sortCount?: number;
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
const getPrimaryRole = (playerRoles?: PlayerRole[]): string | undefined => {
  if (!playerRoles || playerRoles.length === 0) return undefined;
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

    if (!roleA && !roleB) return 0;
    if (!roleA) return 1;
    if (!roleB) return -1;

    const priorityA = ROLE_ICONS[roleA]?.priority ?? 999;
    const priorityB = ROLE_ICONS[roleB]?.priority ?? 999;

    return priorityA - priorityB;
  });
};

// Función para obtener roles del jugador
const getPlayerRoles = (player: Player | TbdPlayer): string[] => {
  if (player.playerRoles && Array.isArray(player.playerRoles)) {
    if (
      player.playerRoles.length > 0 &&
      typeof player.playerRoles[0] === 'object' &&
      'role' in player.playerRoles[0]
    ) {
      return (player.playerRoles as PlayerRole[]).map((pr) => pr.role);
    }
    return player.playerRoles as unknown as string[];
  }
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
  isCompactView = false,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Calcular promedios localmente si no vienen en props
  const calculateLocalAvgAge = (players: any[]): number | undefined => {
    if (!players || players.length === 0) return undefined;
    const playersWithAge = players.filter(
      (p) => p.age !== undefined && p.age !== null
    );
    if (playersWithAge.length === 0) return undefined;
    const sum = playersWithAge.reduce(
      (acc, player) => acc + (player.age || 0),
      0
    );
    return Math.round(sum / playersWithAge.length);
  };

  const calculateLocalAvgRating = (players: any[]): number | undefined => {
    if (!players || players.length === 0) return undefined;
    const playersWithRating = players.filter(
      (p) => p.starRating !== undefined && p.starRating !== null
    );
    if (playersWithRating.length === 0) return undefined;
    const sum = playersWithRating.reduce(
      (acc, player) => acc + (player.starRating || 0),
      0
    );
    return parseFloat((sum / playersWithRating.length).toFixed(1));
  };

  const effectiveTeamAAvgAge = teamAAvgAge ?? calculateLocalAvgAge(playersA);
  const effectiveTeamBAvgAge = teamBAvgAge ?? calculateLocalAvgAge(playersB);
  const effectiveTeamAAvgRating =
    teamAAvgRating ?? calculateLocalAvgRating(playersA);
  const effectiveTeamBAvgRating =
    teamBAvgRating ?? calculateLocalAvgRating(playersB);

  // Filtrar TBD players por equipo
  const teamATbdPlayers = tbdPlayers.filter((player) => player.isTeamA);
  const teamBTbdPlayers = tbdPlayers.filter((player) => !player.isTeamA);

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
      if (sliderRef.current) {
        const scrollLeft = sliderRef.current.scrollLeft;
        const width = sliderRef.current.offsetWidth;
        const newSlide = Math.round(scrollLeft / width);
        setCurrentSlide(newSlide);
      }
    };

    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener('scroll', handleScroll);
      return () => slider.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Componente para un jugador individual
  const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    isTbd = false,
    showReplaceButton = false,
    isTeamA,
  }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
      if (player.playerRoles && Array.isArray(player.playerRoles)) {
        if (
          player.playerRoles.length > 0 &&
          typeof player.playerRoles[0] === 'object' &&
          'role' in player.playerRoles[0]
        ) {
          const sortedRoles = [...(player.playerRoles as PlayerRole[])].sort(
            (a, b) => a.priority - b.priority
          );
          return sortedRoles.map((pr) => ({
            role: pr.role,
            priority: pr.priority,
          }));
        }
        const stringRoles = player.playerRoles as unknown as string[];
        return stringRoles.map((role, index) => ({
          role,
          priority: index + 1,
        }));
      }
      return [];
    };

    const userSelectedRoles = getUserSelectedRoles();

    let displayRoles: {
      role: string;
      priority: number;
      isAssigned: boolean;
    }[] = [];

    userSelectedRoles.forEach((roleObj) => {
      displayRoles.push({
        role: roleObj.role,
        priority: roleObj.priority,
        isAssigned: player.assignedRole === roleObj.role,
      });
    });

    if (
      player.assignedRole &&
      !userSelectedRoles.some((r) => r.role === player.assignedRole)
    ) {
      displayRoles.push({
        role: player.assignedRole,
        priority: 999,
        isAssigned: true,
      });
    }

    displayRoles.sort((a, b) => a.priority - b.priority);

    const roleDisplayData = displayRoles.map((roleData) => ({
      role: roleData.role,
      icon:
        ROLE_ICONS[roleData.role]?.icon ||
        ROLE_ICONS[PLAYER_ROLES.WILDCARD]?.icon,
      isAssigned: roleData.isAssigned,
      priority: roleData.priority,
    }));

    return (
      <div
        className={`
        flex items-center justify-between py-3 px-3 rounded-xl transition-all duration-200
        ${
          isTbd
            ? 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
            : isTeamA
            ? 'bg-primary-50 border border-primary-200 hover:bg-primary-100 hover:border-primary-300'
            : 'bg-lime-50 border border-lime-200 hover:bg-lime-100 hover:border-lime-300'
        }
        hover:shadow-md
      `}
      >
        <div className='flex items-center gap-3 flex-grow min-w-0'>
          {/* Avatar with dropdown */}
          <div className='relative' ref={dropdownRef}>
            <button
              onClick={() => {
                if (currentUserIsAdmin && onSwapPlayer && !isTbd) {
                  setDropdownOpen(!dropdownOpen);
                }
              }}
              className={`${
                currentUserIsAdmin && onSwapPlayer && !isTbd
                  ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all transform hover:scale-110'
                  : 'cursor-default'
              }`}
              disabled={!currentUserIsAdmin || !onSwapPlayer || isTbd}
            >
              {isTbd ? (
                <div className='h-12 w-12 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center shadow-sm'>
                  <UserIcon className='h-6 w-6 text-gray-400' />
                </div>
              ) : (
                <Avatar
                  src={player.avatar || ''}
                  alt={player.name || 'Jugador'}
                  className='h-12 w-12 rounded-full border-2 border-white shadow-md'
                />
              )}
            </button>

            {/* Star Rating below avatar */}
            {!isTbd && player.starRating !== undefined && (
              <div className='absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-100 px-1 py-0.5 rounded text-xs font-medium text-gray-600 whitespace-nowrap'>
                {player.starRating} ⭐
              </div>
            )}

            {/* Dropdown Menu */}
            {dropdownOpen && currentUserIsAdmin && onSwapPlayer && !isTbd && (
              <div className='absolute top-12 left-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999999]'>
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

          {/* Player Info */}
          <div className='min-w-0 flex-grow'>
            <div className='flex items-center gap-1 mb-1'>
              <p className='font-medium text-gray-900 text-sm truncate'>
                {player.name || (isTbd ? 'TBD' : 'Jugador sin nombre')}
                {player.age && !isTbd && (
                  <span className='text-gray-400 font-normal ml-1'>
                    ({player.age})
                  </span>
                )}
              </p>
            </div>

            {/* Assigned role and user selected roles */}
            {!isTbd && (
              <div className='flex items-center gap-2 mb-1'>
                {/* Assigned role name */}
                {player.assignedRole && (
                  <span className='text-xs font-medium text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full'>
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

                {/* User selected role icons */}
                <div className='flex gap-1'>
                  {roleDisplayData.map((roleData, index) => (
                    <span
                      key={index}
                      className={`flex-shrink-0 ${
                        roleData.isAssigned
                          ? 'bg-lime-100 p-1 rounded border border-lime-300'
                          : roleData.priority === 1
                          ? 'bg-primary-50 p-1 rounded border border-primary-200'
                          : 'bg-gray-50 p-1 rounded border border-gray-200'
                      }`}
                      title={`${roleData.role} ${
                        roleData.isAssigned
                          ? '(Asignado)'
                          : roleData.priority === 1
                          ? '(Primario)'
                          : '(Secundario)'
                      }`}
                    >
                      {roleData.icon}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Status info */}
            {(player.playerType === 'TBD' || isTbd) && (
              <span className='text-xs text-gray-500 italic'>
                Jugador pendiente
              </span>
            )}
          </div>
        </div>

        {/* Admin button */}
        {currentUserIsAdmin && showReplaceButton && onReplaceTbd && (
          <button
            onClick={() => onReplaceTbd(player.id)}
            className='p-2 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 transition-colors'
            title='Reemplazar jugador'
          >
            <UserPlusIcon className='h-4 w-4' />
          </button>
        )}
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
  const getPositionName = (position: string): string => {
    switch (position) {
      case PLAYER_ROLES.GOALKEEPER:
        return 'Arqueros';
      case PLAYER_ROLES.DEFENDER:
        return 'Defensores';
      case PLAYER_ROLES.MIDFIELDER:
        return 'Mediocampistas';
      case PLAYER_ROLES.FORWARD:
        return 'Delanteros';
      case PLAYER_ROLES.WILDCARD:
        return 'Comodines';
      default:
        return 'Sin posición';
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
    const allPlayers = [...players, ...tbdPlayers];
    const groupedPlayers = groupPlayersByPosition(allPlayers);

    return (
      <div className='rounded-3xl shadow-sm border border-gray-200 min-w-0 flex-shrink-0 w-full md:w-auto transition-all duration-200 hover:shadow-md hover:border-gray-300 bg-white overflow-hidden'>
        {/* Team Header - New design with gradient */}
        <div
          className={`p-5 pb-8 ${
            isTeamA
              ? 'bg-gradient-to-b from-primary-200 via-primary-100 via-gray-50 to-white'
              : 'bg-gradient-to-b from-lime-200 via-lime-100 via-gray-50 to-white'
          }`}
        >
          {/* Team name centered - moved up */}
          <div className='text-center mb-4'>
            <h3
              className={`text-xl font-bold ${
                isTeamA ? 'text-primary-900' : 'text-lime-900'
              }`}
            >
              {teamName}
            </h3>
          </div>

          {/* Bottom row with age and rating */}
          <div className='flex justify-between items-center'>
            {/* Age on the left */}
            <div className='text-sm font-medium text-gray-700'>
              {avgAge !== undefined ? `${avgAge} 🎂` : ''}
            </div>

            {/* Rating on the right */}
            <div className='text-sm font-medium text-gray-700'>
              {avgRating !== undefined ? `${avgRating} ⭐` : ''}
            </div>
          </div>
        </div>

        {/* Players List Grouped by Position */}
        <div className='p-5 pt-0 space-y-3'>
          {groupedPlayers.map((group, groupIndex) => (
            <div key={group.position}>
              {/* Position Header */}
              <div className='flex items-center mb-2'>
                <div className='flex-grow h-px bg-gray-300'></div>
                <span className='px-3 text-xs font-medium text-gray-500 bg-gray-50'>
                  {getPositionName(group.position)}
                </span>
                <div className='flex-grow h-px bg-gray-300'></div>
              </div>

              {/* Players in this position */}
              <div className='space-y-1.5'>
                {group.players.map((player) => (
                  <PlayerItem
                    key={player.id}
                    player={player}
                    showReplaceButton={player.playerType === 'TBD'}
                    isTbd={
                      player.playerType === 'TBD' ||
                      tbdPlayers.some((tbd) => tbd.id === player.id)
                    }
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
    const role = getPrimaryRole(playerRoles) || assignedRole;

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

  // Componente para vista compacta
  const CompactView = () => {
    const allPlayersA = [...playersA, ...teamATbdPlayers];
    const allPlayersB = [...playersB, ...teamBTbdPlayers];
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
              {effectiveTeamAAvgAge && `${effectiveTeamAAvgAge} 🎂`}
              {effectiveTeamAAvgAge && effectiveTeamAAvgRating && ' • '}
              {effectiveTeamAAvgRating && `${effectiveTeamAAvgRating} ⭐`}
            </div>
          </div>

          <div className='text-center flex-1'>
            <h3 className='text-xl font-bold text-lime-900 mb-1'>
              {teamBName}
            </h3>
            <div className='text-sm text-gray-600'>
              {effectiveTeamBAvgAge && `${effectiveTeamBAvgAge} 🎂`}
              {effectiveTeamBAvgAge && effectiveTeamBAvgRating && ' • '}
              {effectiveTeamBAvgRating && `${effectiveTeamBAvgRating} ⭐`}
            </div>
          </div>
        </div>

        {/* Lista de jugadores emparejados */}
        <div className='space-y-3'>
          {Array.from({ length: maxPlayers }, (_, index) => {
            const playerA = sortedPlayersA[index];
            const playerB = sortedPlayersB[index];

            return (
              <div
                key={index}
                className='flex items-center justify-between text-lg font-medium'
              >
                {/* Jugador Equipo A */}
                <div className='flex-1 text-right pr-4'>
                  {playerA ? (
                    <span className='text-gray-800'>
                      (
                      {getRoleSymbol(playerA.playerRoles, playerA.assignedRole)}
                      ){' '}
                      {playerA.playerType === 'TBD'
                        ? `TBD-${playerA.name}`
                        : playerA.name || 'Sin nombre'}
                    </span>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </div>

                {/* Separador */}
                <div className='text-gray-400 text-xl font-light px-2'>|</div>

                {/* Jugador Equipo B */}
                <div className='flex-1 text-left pl-4'>
                  {playerB ? (
                    <span className='text-gray-800'>
                      {playerB.playerType === 'TBD'
                        ? `TBD-${playerB.name}`
                        : playerB.name || 'Sin nombre'}{' '}
                      (
                      {getRoleSymbol(playerB.playerRoles, playerB.assignedRole)}
                      )
                    </span>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
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
              players={playersA}
              tbdPlayers={teamATbdPlayers}
              teamName={teamAName || 'Equipo A'}
              isTeamA={true}
              avgAge={effectiveTeamAAvgAge}
              avgRating={effectiveTeamAAvgRating}
            />
            <TeamCard
              players={playersB}
              tbdPlayers={teamBTbdPlayers}
              teamName={teamBName || 'Equipo B'}
              isTeamA={false}
              avgAge={effectiveTeamBAvgAge}
              avgRating={effectiveTeamBAvgRating}
            />
          </div>

          {/* Mobile Slider Layout with better spacing */}
          <div className='md:hidden'>
            {/* Slider Container */}
            <div
              ref={sliderRef}
              className='flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-4 px-4'
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className='snap-center min-w-[300px] flex-shrink-0'>
                <TeamCard
                  players={playersA}
                  tbdPlayers={teamATbdPlayers}
                  teamName={teamAName || 'Equipo A'}
                  isTeamA={true}
                  avgAge={effectiveTeamAAvgAge}
                  avgRating={effectiveTeamAAvgRating}
                />
              </div>
              <div className='snap-center min-w-[300px] flex-shrink-0'>
                <TeamCard
                  players={playersB}
                  tbdPlayers={teamBTbdPlayers}
                  teamName={teamBName || 'Equipo B'}
                  isTeamA={false}
                  avgAge={effectiveTeamBAvgAge}
                  avgRating={effectiveTeamBAvgRating}
                />
              </div>
            </div>

            {/* Navigation Controls */}
            <div className='flex justify-center items-center gap-3 mt-4'>
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
          </div>
        </>
      )}
    </div>
  );
};

export default TeamsList;
