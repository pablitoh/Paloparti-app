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
            ? 'bg-gray-25 border border-gray-200 hover:bg-gray-50'
            : isTeamA
            ? 'bg-primary-25 border border-primary-100 hover:bg-primary-50 hover:border-primary-200'
            : 'bg-coral-25 border border-coral-100 hover:bg-coral-50 hover:border-coral-200'
        }
        hover:shadow-md transform hover:scale-[1.01]
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
              <div className='absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-primary-50 px-1.5 py-0.5 rounded-full border border-primary-200 text-xs font-medium text-primary-700 whitespace-nowrap'>
                {player.starRating} ⭐
              </div>
            )}

            {/* Dropdown Menu */}
            {dropdownOpen && currentUserIsAdmin && onSwapPlayer && !isTbd && (
              <div className='absolute top-12 left-0 w-52 bg-white rounded-2xl shadow-green-lg border border-primary-100 py-2 z-[99999] backdrop-blur-sm'>
                {/* Header del dropdown */}
                <div className='px-4 py-2 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-lime-50 rounded-t-2xl'>
                  <div className='text-xs font-semibold text-primary-700 uppercase tracking-wide'>
                    Acciones del jugador
                  </div>
                </div>

                {/* Opción de intercambiar */}
                <button
                  onClick={() => {
                    onSwapPlayer(player.id, isTeamA);
                    setDropdownOpen(false);
                  }}
                  className='flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-lime-50 hover:to-primary-50 hover:text-lime-700 transition-all duration-200 rounded-b-2xl group'
                >
                  <div className='flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-lime-100 text-lime-600 group-hover:bg-lime-200 transition-colors'>
                    <svg
                      className='w-4 h-4'
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
                  </div>
                  <div>
                    <div className='font-medium text-gray-900 group-hover:text-lime-800'>
                      Intercambiar de equipo
                    </div>
                    <div className='text-xs text-gray-500 group-hover:text-lime-600'>
                      Mover al {isTeamA ? 'Equipo B' : 'Equipo A'}
                    </div>
                  </div>
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

        {/* Admin buttons with better styling */}
        {currentUserIsAdmin && showReplaceButton && onReplaceTbd && (
          <div className='flex gap-2 admin-buttons'>
            <button
              onClick={() => onReplaceTbd(player.id)}
              className={`
                p-2 rounded-xl shadow-sm border transition-all duration-200 transform hover:scale-105
                ${
                  isTeamA
                    ? 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100 hover:border-primary-300'
                    : 'bg-coral-50 text-coral-600 border-coral-200 hover:bg-coral-100 hover:border-coral-300'
                }
              `}
              title='Reemplazar jugador'
            >
              <UserPlusIcon className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>
    );
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
    const sortedPlayers = sortPlayersByRole(players);
    const sortedTbdPlayers = sortPlayersByRole(tbdPlayers);

    return (
      <div
        className={`
        bg-white rounded-2xl shadow-green-lg border 
        ${
          isTeamA
            ? 'border-primary-200 hover:border-primary-300'
            : 'border-coral-200 hover:border-coral-300'
        }
        p-6 min-w-0 flex-shrink-0 w-full md:w-auto
        transform transition-all duration-300 hover:scale-[1.02] hover:shadow-green-xl
        ${isTeamA ? 'hover:bg-primary-25' : 'hover:bg-coral-25'}
      `}
      >
        {/* Team Header with gradient */}
        <div className='text-center mb-6'>
          <div
            className={`
            inline-flex items-center justify-center w-full py-3 px-4 rounded-xl mb-3
            ${
              isTeamA
                ? 'bg-gradient-to-r from-primary-500 to-lime-500 text-white'
                : 'bg-gradient-to-r from-coral-500 to-orange-500 text-white'
            }
            shadow-lg transform transition-all duration-300 hover:scale-105
          `}
          >
            <h3 className='text-lg font-bold'>{teamName}</h3>
          </div>

          {/* Team stats with better design */}
          <div className='flex justify-center items-center gap-3 text-sm'>
            {avgAge !== undefined && (
              <div
                className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-200
                ${
                  isTeamA
                    ? 'bg-primary-50 border border-primary-200 hover:bg-primary-100'
                    : 'bg-coral-50 border border-coral-200 hover:bg-coral-100'
                }
              `}
              >
                <span className='text-gray-600'>👥</span>
                <span className='text-gray-700 font-medium'>{avgAge} años</span>
              </div>
            )}

            {avgRating !== undefined && (
              <div className='flex items-center gap-1 bg-lime-50 px-3 py-1.5 rounded-full border border-lime-200 hover:bg-lime-100 transition-all duration-200'>
                <span className='text-lime-700 font-bold'>{avgRating}</span>
                <span className='text-lime-600'>⭐</span>
              </div>
            )}
          </div>
        </div>

        {/* Players List with better spacing */}
        <div className='space-y-2'>
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className='transform transition-all duration-200 hover:translate-x-1'
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <PlayerItem
                player={player}
                showReplaceButton={player.playerType === 'TBD'}
                isTeamA={isTeamA}
              />
            </div>
          ))}

          {sortedTbdPlayers.map((player, index) => (
            <div
              key={player.id}
              className='transform transition-all duration-200 hover:translate-x-1'
              style={{
                animationDelay: `${(sortedPlayers.length + index) * 50}ms`,
              }}
            >
              <PlayerItem
                player={player}
                isTbd={true}
                showReplaceButton={true}
                isTeamA={isTeamA}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      id={`teams-list-container-${sortCount}`}
      className='w-full px-4'
      data-sort-count={sortCount}
    >
      {/* Desktop Layout with better spacing */}
      <div className='hidden md:flex gap-6 justify-center max-w-6xl mx-auto'>
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
          className='flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-6 px-2'
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
        <div className='flex justify-center items-center gap-4 mt-4'>
          <button
            onClick={prevSlide}
            className={`p-2 rounded-full transition-all ${
              currentSlide === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
            }`}
            disabled={currentSlide === 0}
          >
            <ChevronLeftIcon className='h-5 w-5' />
          </button>

          {/* Dots indicator */}
          <div className='flex gap-2'>
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                currentSlide === 0 ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            />
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                currentSlide === 1 ? 'bg-coral-500' : 'bg-gray-300'
              }`}
            />
          </div>

          <button
            onClick={nextSlide}
            className={`p-2 rounded-full transition-all ${
              currentSlide === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-coral-50 text-coral-500 hover:bg-coral-100'
            }`}
            disabled={currentSlide === 1}
          >
            <ChevronRightIcon className='h-5 w-5' />
          </button>
        </div>

        {/* Swipe hint */}
        <div className='text-center mt-2'>
          <p className='text-xs text-gray-500'>Desliza para comparar equipos</p>
        </div>
      </div>
    </div>
  );
};

export default TeamsList;
