import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

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

  // Estado para controlar filtros y paginación
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Ordenar partidos según el criterio seleccionado
  const sortedMatches = [...completedMatches].sort((a, b) => {
    // Primero intentar ordenar por createdAt
    if (a.createdAt && b.createdAt) {
      return sortOrder === 'asc'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // Usar el campo date como respaldo
    return sortOrder === 'asc'
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Cálculos para la paginación
  const totalPages = Math.ceil(sortedMatches.length / pageSize);
  const paginatedMatches = sortedMatches.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Restablecer la página actual cuando cambia el tamaño de la página
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

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
          {completedMatches.length} partidos
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
        <>
          {/* Filtros y controles de paginación */}
          <div className='flex flex-wrap gap-4 items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center space-x-4'>
              <div className='flex items-center'>
                <span className='text-sm text-gray-600 mr-2'>
                  Ordenar por fecha:
                </span>
                <button
                  onClick={() =>
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }
                  className='inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50'
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUpIcon className='h-4 w-4 mr-1' />
                  ) : (
                    <ArrowDownIcon className='h-4 w-4 mr-1' />
                  )}
                  {sortOrder === 'asc'
                    ? 'Más antiguos primero'
                    : 'Más recientes primero'}
                </button>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='flex items-center'>
                <span className='text-sm text-gray-600 mr-2'>Mostrar:</span>
                <select
                  className='block w-full pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md'
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={5}>5 por página</option>
                  <option value={10}>10 por página</option>
                  <option value={15}>15 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={sortedMatches.length}>Todos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de partidos */}
          <div className='space-y-4'>
            {paginatedMatches.map((match) => (
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
                      <span className='font-medium text-blue-800 text-center'>
                        {match.teamA}
                      </span>
                    </div>

                    {/* Score */}
                    <div className='px-4 py-2 mx-4 border border-gray-200 rounded-lg bg-white shadow-sm'>
                      <div className='flex items-center justify-center space-x-2'>
                        <span className='text-2xl font-bold'>
                          {match.scoreA}
                        </span>
                        <span className='text-gray-400 font-light'>-</span>
                        <span className='text-2xl font-bold'>
                          {match.scoreB}
                        </span>
                      </div>
                      <div className='text-xs text-center text-gray-500 mt-1'>
                        FINAL
                      </div>
                    </div>

                    {/* Team B */}
                    <div className='flex items-center justify-start flex-1'>
                      <span className='font-medium text-red-800 text-center'>
                        {match.teamB}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='px-4 py-3 border-t border-gray-100'>
                  <div className='grid grid-cols-2 gap-4'>
                    {/* Equipo A */}
                    <div className='bg-blue-50 rounded-lg p-3'>
                      <h4 className='text-sm font-medium text-blue-800 mb-3 pb-2 border-b border-blue-100 text-center'>
                        {match.teamA}
                      </h4>
                      <ul className='space-y-2'>
                        {match.playersA?.map((player: Player) => {
                          const goals = getPlayerGoals(match, player.id);
                          return (
                            <li
                              key={player.id}
                              className={`flex items-center justify-center py-1.5 px-2 rounded ${
                                goals > 0
                                  ? 'bg-blue-100 shadow-sm font-semibold'
                                  : 'hover:bg-blue-100/50'
                              }`}
                            >
                              <div className='flex items-center'>
                                <span className='text-sm text-gray-800 text-center'>
                                  {player.name}
                                </span>
                                {goals > 0 && renderGoalBalls(goals)}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Equipo B */}
                    <div className='bg-red-50 rounded-lg p-3'>
                      <h4 className='text-sm font-medium text-red-800 mb-3 pb-2 border-b border-red-100 text-center'>
                        {match.teamB}
                      </h4>
                      <ul className='space-y-2'>
                        {match.playersB?.map((player: Player) => {
                          const goals = getPlayerGoals(match, player.id);
                          return (
                            <li
                              key={player.id}
                              className={`flex items-center justify-center py-1.5 px-2 rounded ${
                                goals > 0
                                  ? 'bg-red-100 shadow-sm font-semibold'
                                  : 'hover:bg-red-100/50'
                              }`}
                            >
                              <div className='flex items-center'>
                                <span className='text-sm text-gray-800 text-center'>
                                  {player.name}
                                </span>
                                {goals > 0 && renderGoalBalls(goals)}
                              </div>
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

          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm border border-gray-200'>
              <div className='flex flex-1 justify-between sm:hidden'>
                <button
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Anterior
                </button>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(currentPage + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Siguiente
                </button>
              </div>
              <div className='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
                <div>
                  <p className='text-sm text-gray-700'>
                    Mostrando{' '}
                    <span className='font-medium'>
                      {(currentPage - 1) * pageSize + 1}
                    </span>{' '}
                    a{' '}
                    <span className='font-medium'>
                      {Math.min(currentPage * pageSize, sortedMatches.length)}
                    </span>{' '}
                    de{' '}
                    <span className='font-medium'>{sortedMatches.length}</span>{' '}
                    partidos
                  </p>
                </div>
                <div>
                  <nav
                    className='relative z-0 inline-flex rounded-md shadow-sm -space-x-px'
                    aria-label='Pagination'
                  >
                    {/* Botón Anterior */}
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(currentPage - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className='sr-only'>Anterior</span>
                      <svg
                        className='h-5 w-5'
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                        aria-hidden='true'
                      >
                        <path
                          fillRule='evenodd'
                          d='M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </button>

                    {/* Números de página */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    {/* Botón Siguiente */}
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(currentPage + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className='sr-only'>Siguiente</span>
                      <svg
                        className='h-5 w-5'
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                        aria-hidden='true'
                      >
                        <path
                          fillRule='evenodd'
                          d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
