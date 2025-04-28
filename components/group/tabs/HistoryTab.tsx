import { useRouter } from 'next/router';
import React from 'react';

// Define the types directly in the file
interface Player {
  id: string;
  name: string | null;
  avatar: string | null;
}

interface MatchInterface {
  id: string;
  date: string | Date;
  createdAt?: string | Date;
  location: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  playersA?: Player[];
  playersB?: Player[];
  goals?: Array<{
    id: string;
    isTeamA: boolean;
    scorerId: string;
    scorerName: string | null;
    scorerAvatar: string | null;
    minute?: number;
  }>;
}

interface HistoryTabProps {
  completedMatches: MatchInterface[];
  id: string;
  formatMatchDate: (date: string | Date) => string;
  getScoreForTeam: (match: MatchInterface, isTeamA: boolean) => number;
  getPlayerGoals: (match: MatchInterface, playerId: string) => number;
  renderGoalBalls: (count: number) => React.ReactNode | null;
}

export default function HistoryTab({
  completedMatches,
  id,
  formatMatchDate,
  getScoreForTeam,
  getPlayerGoals,
  renderGoalBalls,
}: HistoryTabProps) {
  const router = useRouter();

  // Sort matches by creation date (fallback to match date if createdAt not available)
  const sortedMatches = [...completedMatches].sort((a, b) => {
    // First try to sort by createdAt
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // Fall back to date field
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const redirectToGroup = (tabIndex = 1) => {
    // Navigate to group page with history tab selected
    router.push(`/group/${id}?tab=${tabIndex}`);
  };

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-semibold text-gray-900'>
          Historial de partidos
        </h3>
        <span className='text-sm text-gray-500'>
          {completedMatches.length} partidos jugados
        </span>
      </div>

      {completedMatches.length === 0 ? (
        <div className='bg-white rounded-lg p-6 text-center border border-gray-200 shadow-sm'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-12 w-12 mx-auto text-gray-400 mb-4'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1}
              d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
            />
          </svg>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            No hay partidos completados
          </h3>
          <p className='text-gray-500 max-w-md mx-auto'>
            Este grupo aún no tiene partidos finalizados en su historial.
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {sortedMatches.map((match) => (
            <div
              key={match.id}
              className='bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition duration-200'
            >
              {/* Header with match date and location */}
              <div className='bg-gray-50 px-4 py-3 border-b border-gray-200'>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center space-x-2'>
                    <svg
                      className='h-4 w-4 text-gray-500'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                      />
                    </svg>
                    <span className='text-sm font-medium text-gray-700'>
                      {formatMatchDate(match.date)}
                    </span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <svg
                      className='h-4 w-4 text-gray-500'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                    <span className='text-sm text-gray-600'>
                      {match.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Score section */}
              <div className='py-4 px-4 bg-gradient-to-r from-gray-50 to-white'>
                <div className='flex items-center justify-center'>
                  {/* Team A */}
                  <div className='flex items-center justify-end flex-1'>
                    <span className='font-medium text-blue-800'>
                      {match.teamA}
                    </span>
                    <div className='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center ml-2 text-white font-bold'>
                      A
                    </div>
                  </div>

                  {/* Score */}
                  <div className='px-4 py-2 mx-4 border border-gray-200 rounded-lg bg-white shadow-sm'>
                    <div className='flex items-center justify-center space-x-2'>
                      <span className='text-2xl font-bold'>{match.scoreA}</span>
                      <span className='text-gray-400 font-light'>-</span>
                      <span className='text-2xl font-bold'>{match.scoreB}</span>
                    </div>
                    <div className='text-xs text-center text-gray-500 mt-1'>
                      FINAL
                    </div>
                  </div>

                  {/* Team B */}
                  <div className='flex items-center justify-start flex-1'>
                    <div className='w-10 h-10 bg-red-600 rounded-full flex items-center justify-center mr-2 text-white font-bold'>
                      B
                    </div>
                    <span className='font-medium text-red-800'>
                      {match.teamB}
                    </span>
                  </div>
                </div>
              </div>

              <div className='px-4 py-3 border-t border-gray-100'>
                <div className='grid grid-cols-2 gap-4'>
                  {/* Equipo A */}
                  <div className='bg-blue-50 rounded-lg p-3'>
                    <h4 className='text-sm font-medium text-blue-800 mb-3 pb-2 border-b border-blue-100 flex items-center'>
                      <span className='w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs mr-2'>
                        A
                      </span>
                      {match.teamA}
                    </h4>
                    <ul className='space-y-2'>
                      {match.playersA?.map((player: Player) => {
                        const goals = getPlayerGoals(match, player.id);
                        return (
                          <li
                            key={player.id}
                            className={`flex items-center justify-between py-1.5 px-2 rounded ${
                              goals > 0
                                ? 'bg-blue-100 shadow-sm font-semibold'
                                : 'hover:bg-blue-100/50'
                            }`}
                          >
                            <span className='text-sm text-gray-800 truncate max-w-[120px]'>
                              {player.name}
                            </span>
                            {goals > 0 && renderGoalBalls(goals)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Equipo B */}
                  <div className='bg-red-50 rounded-lg p-3'>
                    <h4 className='text-sm font-medium text-red-800 mb-3 pb-2 border-b border-red-100 flex items-center'>
                      <span className='w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs mr-2'>
                        B
                      </span>
                      {match.teamB}
                    </h4>
                    <ul className='space-y-2'>
                      {match.playersB?.map((player: Player) => {
                        const goals = getPlayerGoals(match, player.id);
                        return (
                          <li
                            key={player.id}
                            className={`flex items-center justify-between py-1.5 px-2 rounded ${
                              goals > 0
                                ? 'bg-red-100 shadow-sm font-semibold'
                                : 'hover:bg-red-100/50'
                            }`}
                          >
                            <span className='text-sm text-gray-800 truncate max-w-[120px]'>
                              {player.name}
                            </span>
                            {goals > 0 && renderGoalBalls(goals)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
