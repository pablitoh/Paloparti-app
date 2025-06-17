import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
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
  const [showFilters, setShowFilters] = useState<boolean>(false);

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
        <div className='bg-white rounded-2xl p-8 text-center border border-primary-200 shadow-green-lg'>
          <div className='w-16 h-16 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
            <span className='text-2xl' role='img' aria-label='history'>
              📅
            </span>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            No hay partidos completados
          </h3>
          <p className='text-primary-600 max-w-md mx-auto'>
            El historial se llenará automáticamente cuando se completen los
            partidos.
          </p>
        </div>
      ) : (
        <>
          {/* Filtros y controles de paginación */}
          <div className='bg-gradient-to-r from-lime-400/10 via-primary-50 to-coral-400/10 rounded-2xl shadow-green-lg border-2 border-primary-200/50 backdrop-blur-sm overflow-hidden transition-all duration-300'>
            {/* Header de filtros - Siempre visible y clickeable */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='w-full flex items-center justify-between p-4 sm:p-6 hover:bg-primary-25/50 transition-colors duration-200 group'
            >
              <div className='flex items-center space-x-3'>
                <div className='w-10 h-10 bg-gradient-lime rounded-full flex items-center justify-center shadow-lime group-hover:scale-110 transition-transform duration-200'>
                  <span className='text-base' role='img' aria-label='filter'>
                    🔍
                  </span>
                </div>
                <div className='text-left'>
                  <h4 className='text-lg font-bold text-primary-800 group-hover:text-primary-900'>
                    Filtros y ordenamiento
                  </h4>
                  <p className='text-sm text-primary-600 group-hover:text-primary-700'>
                    {showFilters
                      ? 'Ocultar opciones'
                      : 'Mostrar opciones de filtrado'}
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <div className='bg-gradient-green-soft px-3 py-1.5 rounded-full border border-primary-200 shadow-sm'>
                  <span className='text-xs font-semibold text-primary-700'>
                    {completedMatches.length} partidos
                  </span>
                </div>
                <div className='w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-primary-200 group-hover:border-lime-400 transition-all duration-200'>
                  {showFilters ? (
                    <ChevronUpIcon className='h-5 w-5 text-primary-600 group-hover:text-lime-600' />
                  ) : (
                    <ChevronDownIcon className='h-5 w-5 text-primary-600 group-hover:text-lime-600' />
                  )}
                </div>
              </div>
            </button>

            {/* Controles de filtros - Colapsables con animación */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                showFilters
                  ? 'max-h-96 opacity-100 pb-4 sm:pb-6'
                  : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className='px-4 sm:px-6 pt-4 border-t border-primary-200/30'>
                <div className='space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-6'>
                  {/* Ordenamiento */}
                  <div className='flex-1'>
                    <label className='block text-sm font-semibold text-primary-700 mb-2 sm:hidden'>
                      📅 Ordenar por fecha
                    </label>
                    <div className='flex items-center space-x-2 sm:space-x-3'>
                      <span className='hidden sm:inline-flex text-sm font-semibold text-primary-700 whitespace-nowrap'>
                        📅 Ordenar:
                      </span>
                      <button
                        onClick={() =>
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                        }
                        className='flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 sm:px-3 sm:py-2 border-2 border-primary-300 rounded-xl bg-white text-sm font-semibold text-primary-700 hover:bg-gradient-green-light hover:border-lime-400 transition-all duration-200 shadow-sm hover:shadow-lime min-h-[44px] sm:min-h-0'
                      >
                        {sortOrder === 'asc' ? (
                          <ArrowUpIcon className='h-5 w-5 sm:h-4 sm:w-4 mr-2 text-lime-600' />
                        ) : (
                          <ArrowDownIcon className='h-5 w-5 sm:h-4 sm:w-4 mr-2 text-coral-500' />
                        )}
                        <span className='sm:hidden'>
                          {sortOrder === 'asc'
                            ? 'Antiguos primero'
                            : 'Recientes primero'}
                        </span>
                        <span className='hidden sm:inline'>
                          {sortOrder === 'asc'
                            ? 'Más antiguos'
                            : 'Más recientes'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Separador visual en desktop */}
                  <div className='hidden sm:block w-px h-8 bg-gradient-to-b from-primary-200 to-transparent'></div>

                  {/* Paginación */}
                  <div className='flex-1'>
                    <label className='block text-sm font-semibold text-primary-700 mb-2 sm:hidden'>
                      📄 Mostrar por página
                    </label>
                    <div className='flex items-center space-x-2 sm:space-x-3'>
                      <span className='hidden sm:inline-flex text-sm font-semibold text-primary-700 whitespace-nowrap'>
                        📄 Mostrar:
                      </span>
                      <select
                        className='flex-1 sm:flex-none block pl-4 pr-10 py-2.5 sm:py-2 text-base sm:text-sm border-2 border-primary-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-400 rounded-xl bg-white text-primary-700 font-medium shadow-sm hover:shadow-lime transition-all duration-200 min-h-[44px] sm:min-h-0'
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                      >
                        <option value={5}>5 partidos</option>
                        <option value={10}>10 partidos</option>
                        <option value={15}>15 partidos</option>
                        <option value={20}>20 partidos</option>
                        <option value={sortedMatches.length}>
                          Todos ({sortedMatches.length})
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Stats rápidas - Solo en mobile */}
                <div className='mt-4 pt-4 border-t border-primary-200/50 sm:hidden'>
                  <div className='grid grid-cols-3 gap-3'>
                    <div className='bg-gradient-green-light p-3 rounded-xl text-center border border-primary-200'>
                      <div className='text-lg font-bold text-primary-800'>
                        {completedMatches.length}
                      </div>
                      <div className='text-xs text-primary-600 font-medium'>
                        Total
                      </div>
                    </div>
                    <div className='bg-gradient-to-br from-lime-400/20 to-lime-600/20 p-3 rounded-xl text-center border border-lime-400/30'>
                      <div className='text-lg font-bold text-green-800'>
                        {Math.ceil(completedMatches.length / 2)}
                      </div>
                      <div className='text-xs text-green-700 font-medium'>
                        Aprox/Mes
                      </div>
                    </div>
                    <div className='bg-gradient-to-br from-coral-400/20 to-coral-600/20 p-3 rounded-xl text-center border border-coral-400/30'>
                      <div className='text-lg font-bold text-coral-700'>
                        {paginatedMatches.length}
                      </div>
                      <div className='text-xs text-coral-600 font-medium'>
                        Mostrando
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de partidos */}
          <div className='space-y-4'>
            {paginatedMatches.map((match) => (
              <div
                key={match.id}
                className='bg-white rounded-2xl overflow-hidden shadow-green-sm border border-primary-200 hover:shadow-green-md transition-all duration-200'
              >
                {/* Header with match date and location */}
                <div className='bg-gradient-green-soft px-4 py-3 border-b border-primary-200'>
                  <div className='flex justify-between items-center'>
                    <div className='flex items-center space-x-2'>
                      <svg
                        className='h-4 w-4 text-primary-600'
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
                      <span className='text-sm font-semibold text-primary-700'>
                        {formatMatchDate(match.date)}
                      </span>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <svg
                        className='h-4 w-4 text-primary-600'
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
                      <span className='text-sm text-primary-600 font-medium'>
                        {match.location}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score section */}
                <div className='py-4 px-4 bg-gradient-to-r from-primary-25 to-white'>
                  <div className='flex items-center justify-center'>
                    {/* Team A */}
                    <div className='flex items-center justify-end flex-1'>
                      <span className='font-semibold text-primary-800 text-center'>
                        {match.teamA}
                      </span>
                    </div>

                    {/* Score */}
                    <div className='px-4 py-2 mx-4 border border-primary-200 rounded-xl bg-white shadow-green-sm'>
                      <div className='flex items-center justify-center space-x-2'>
                        <span className='text-2xl font-bold text-primary-800'>
                          {match.scoreA}
                        </span>
                        <span className='text-primary-400 font-light'>-</span>
                        <span className='text-2xl font-bold text-primary-800'>
                          {match.scoreB}
                        </span>
                      </div>
                      <div className='text-xs text-center text-primary-600 mt-1 font-medium'>
                        FINAL
                      </div>
                    </div>

                    {/* Team B */}
                    <div className='flex items-center justify-start flex-1'>
                      <span className='font-semibold text-primary-800 text-center'>
                        {match.teamB}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='px-4 py-3 border-t border-primary-100'>
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                    {/* Equipo A */}
                    <div
                      className={`rounded-xl p-3 relative ${
                        match.scoreA > match.scoreB
                          ? 'bg-gradient-to-br from-primary-100/80 to-primary-200/60 border-2 border-primary-300'
                          : match.scoreA < match.scoreB
                          ? 'bg-gradient-to-br from-coral-400/20 to-coral-600/20 border border-coral-400/40'
                          : 'bg-gradient-to-br from-slate-400/20 to-slate-500/20 border border-slate-400/40'
                      }`}
                    >
                      <h4
                        className={`text-sm font-semibold mb-3 pb-2 border-b text-center relative pt-4 ${
                          match.scoreA > match.scoreB
                            ? 'text-primary-800 border-primary-300/50'
                            : match.scoreA < match.scoreB
                            ? 'text-coral-600 border-coral-400/50'
                            : 'text-slate-600 border-slate-400/50'
                        }`}
                      >
                        {/* Coronita centrada arriba del nombre */}
                        {match.scoreA > match.scoreB && (
                          <span
                            className='absolute -top-1 left-1/2 transform -translate-x-1/2 text-lg'
                            role='img'
                            aria-label='crown'
                          >
                            👑
                          </span>
                        )}
                        {match.teamA}
                      </h4>
                      <ul className='space-y-2'>
                        {match.playersA?.map((player: Player) => {
                          const goals = getPlayerGoals(match, player.id);
                          const isWinner = match.scoreA > match.scoreB;
                          return (
                            <li
                              key={player.id}
                              className={`flex items-center justify-center py-2 px-3 rounded-lg transition-colors duration-200 relative ${
                                goals > 0
                                  ? isWinner
                                    ? 'bg-lime-400/30 shadow-lime font-semibold border border-lime-400/40'
                                    : 'bg-coral-400/30 shadow-coral font-semibold border border-coral-400/40'
                                  : isWinner
                                  ? 'hover:bg-lime-400/20'
                                  : 'hover:bg-coral-400/20'
                              }`}
                            >
                              <span
                                className={`text-sm text-center ${
                                  isWinner ? 'text-green-800' : 'text-coral-700'
                                }`}
                              >
                                {player.name}
                              </span>
                              {goals > 0 && (
                                <span className='absolute right-3 text-sm font-semibold flex items-center gap-1 whitespace-nowrap'>
                                  {goals} ⚽
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Equipo B */}
                    <div
                      className={`rounded-xl p-3 relative ${
                        match.scoreB > match.scoreA
                          ? 'bg-gradient-to-br from-primary-100/80 to-primary-200/60 border-2 border-primary-300'
                          : match.scoreB < match.scoreA
                          ? 'bg-gradient-to-br from-coral-400/20 to-coral-600/20 border border-coral-400/40'
                          : 'bg-gradient-to-br from-slate-400/20 to-slate-500/20 border border-slate-400/40'
                      }`}
                    >
                      <h4
                        className={`text-sm font-semibold mb-3 pb-2 border-b text-center relative pt-4 ${
                          match.scoreB > match.scoreA
                            ? 'text-primary-800 border-primary-300/50'
                            : match.scoreB < match.scoreA
                            ? 'text-coral-600 border-coral-400/50'
                            : 'text-slate-600 border-slate-400/50'
                        }`}
                      >
                        {/* Coronita centrada arriba del nombre */}
                        {match.scoreB > match.scoreA && (
                          <span
                            className='absolute -top-1 left-1/2 transform -translate-x-1/2 text-lg'
                            role='img'
                            aria-label='crown'
                          >
                            👑
                          </span>
                        )}
                        {match.teamB}
                      </h4>
                      <ul className='space-y-2'>
                        {match.playersB?.map((player: Player) => {
                          const goals = getPlayerGoals(match, player.id);
                          const isWinner = match.scoreB > match.scoreA;
                          return (
                            <li
                              key={player.id}
                              className={`flex items-center justify-center py-2 px-3 rounded-lg transition-colors duration-200 relative ${
                                goals > 0
                                  ? isWinner
                                    ? 'bg-lime-400/30 shadow-lime font-semibold border border-lime-400/40'
                                    : 'bg-coral-400/30 shadow-coral font-semibold border border-coral-400/40'
                                  : isWinner
                                  ? 'hover:bg-lime-400/20'
                                  : 'hover:bg-coral-400/20'
                              }`}
                            >
                              <span
                                className={`text-sm text-center ${
                                  isWinner ? 'text-green-800' : 'text-coral-700'
                                }`}
                              >
                                {player.name}
                              </span>
                              {goals > 0 && (
                                <span className='absolute right-3 text-sm font-semibold flex items-center gap-1 whitespace-nowrap'>
                                  {goals} ⚽
                                </span>
                              )}
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
            <div className='flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-xl shadow-green-sm border border-primary-200'>
              <div className='flex flex-1 justify-between sm:hidden'>
                <button
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-colors duration-200 ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                      : 'bg-white text-primary-700 hover:bg-primary-50 border-primary-200'
                  }`}
                >
                  Anterior
                </button>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(currentPage + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`relative ml-3 inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-colors duration-200 ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                      : 'bg-white text-primary-700 hover:bg-primary-50 border-primary-200'
                  }`}
                >
                  Siguiente
                </button>
              </div>
              <div className='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
                <div>
                  <p className='text-sm text-primary-700'>
                    Mostrando{' '}
                    <span className='font-semibold'>
                      {(currentPage - 1) * pageSize + 1}
                    </span>{' '}
                    a{' '}
                    <span className='font-semibold'>
                      {Math.min(currentPage * pageSize, sortedMatches.length)}
                    </span>{' '}
                    de{' '}
                    <span className='font-semibold'>
                      {sortedMatches.length}
                    </span>{' '}
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
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-lg border text-sm font-medium transition-colors duration-200 ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                          : 'bg-white text-primary-600 hover:bg-primary-50 border-primary-200'
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
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors duration-200 ${
                            page === currentPage
                              ? 'z-10 bg-gradient-green-soft border-primary-500 text-primary-700 font-semibold'
                              : 'bg-white border-primary-200 text-primary-600 hover:bg-primary-50'
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
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-lg border text-sm font-medium transition-colors duration-200 ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                          : 'bg-white text-primary-600 hover:bg-primary-50 border-primary-200'
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
