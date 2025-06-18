import { useState, useMemo } from 'react';
import { useGroupLogs } from '../../../services/groupHooks';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar } from '@mui/material';
import { LogAction } from '../../../utils/logTypes';
import {
  FunnelIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

interface LogsTabProps {
  groupId: string;
}

// Grupos de acciones para el filtro
const actionGroups = {
  all: 'Todas las acciones',
  match: 'Partidos',
  attendance: 'Asistencia',
  members: 'Miembros',
  teams: 'Equipos',
};

// Mapear acciones a sus grupos
const actionToGroup: Record<string, string> = {
  [LogAction.MATCH_CREATED]: 'match',
  [LogAction.MATCH_EDITED]: 'match',
  [LogAction.MATCH_DELETED]: 'match',
  [LogAction.MATCH_COMPLETED]: 'match',
  [LogAction.MATCH_RESULT_ADDED]: 'match',
  [LogAction.MATCH_RESULT_EDITED]: 'match',

  [LogAction.USER_ATTENDANCE_UPDATED]: 'attendance',
  [LogAction.ADMIN_ATTENDANCE_UPDATED]: 'attendance',
  [LogAction.ATTENDANCE_RESET]: 'attendance',

  [LogAction.USER_JOINED]: 'members',
  [LogAction.USER_LEFT]: 'members',
  [LogAction.USER_ROLE_CHANGED]: 'members',
  [LogAction.STAR_RATING_UPDATED]: 'members',
  [LogAction.MEMBER_RATING_UPDATED]: 'members',

  [LogAction.TEAM_SORTED]: 'teams',
  [LogAction.TEAM_RESORTED]: 'teams',
  [LogAction.PLAYER_REPLACED]: 'teams',
  [LogAction.PLAYER_SWAPPED]: 'teams',
};

// Mapeo de tipos de acción a mensajes legibles
const actionMessages: Record<string, (details: any) => string> = {
  [LogAction.TEAM_SORTED]: () => 'formó equipos',
  [LogAction.TEAM_RESORTED]: () => 'reordenó los equipos',
  [LogAction.MATCH_DELETED]: () => 'eliminó un partido',
  [LogAction.MATCH_CREATED]: () => 'creó un nuevo partido',
  [LogAction.PLAYER_REPLACED]: (details) =>
    `reemplazó a **${details.oldPlayer?.name || 'TBD'}** por **${
      details.newPlayer?.name || 'un jugador'
    }**`,
  [LogAction.PLAYER_SWAPPED]: (details) =>
    `intercambió a **${details.player1?.name || 'un jugador'}** (Equipo ${
      details.player1?.originalTeam || '?'
    }) con **${details.player2?.name || 'un jugador'}** (Equipo ${
      details.player2?.originalTeam || '?'
    })`,
  [LogAction.ATTENDANCE_RESET]: () => 'reinició la asistencia del partido',
  [LogAction.GROUP_EDITED]: () => 'editó la información del grupo',
  [LogAction.MATCH_EDITED]: () => 'editó la información del partido',
  [LogAction.USER_JOINED]: () => 'se unió al grupo',
  [LogAction.USER_LEFT]: () => 'abandonó el grupo',
  [LogAction.USER_ATTENDANCE_UPDATED]: (details) =>
    `actualizó su asistencia a "${
      details.status === 'CONFIRMED'
        ? 'Confirmado'
        : details.status === 'DECLINED'
        ? 'No asistirá'
        : 'Pendiente'
    }"`,
  [LogAction.ADMIN_ATTENDANCE_UPDATED]: (details) =>
    `actualizó la asistencia de **${details.userName || 'un jugador'}** a "${
      details.status === 'CONFIRMED'
        ? 'Confirmado'
        : details.status === 'DECLINED'
        ? 'No asistirá'
        : 'Pendiente'
    }"`,
  [LogAction.USER_ROLE_CHANGED]: (details) =>
    `cambió el rol de **${details.targetUser?.name || 'un usuario'}** a ${
      details.newRole === 'ADMIN' ? 'Administrador' : 'Miembro'
    }`,
  [LogAction.MATCH_RESULT_ADDED]: () => 'añadió el resultado del partido',
  [LogAction.MATCH_RESULT_EDITED]: () => 'editó el resultado del partido',
  [LogAction.MATCH_COMPLETED]: (details) =>
    `registró el resultado final del partido: **${details.teamAName}** ${details.scoreA} - ${details.scoreB} **${details.teamBName}**`,
  [LogAction.STAR_RATING_UPDATED]: (details) =>
    details.message ||
    `cambió el nivel de habilidad de **${
      details.targetUserName || 'un jugador'
    }** de ${details.previousRating} a ${details.newRating} estrellas`,
};

// Función para renderizar texto con formato Markdown simple
const renderFormattedText = (text: string) => {
  // Procesar negrita: **texto** -> <strong>texto</strong>
  const boldRegex = /\*\*(.*?)\*\*/g;
  const formattedText = text.replace(boldRegex, '<strong>$1</strong>');

  return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
};

const LogsTab: React.FC<LogsTabProps> = ({ groupId }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionFilter, setActionFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, error } = useGroupLogs(
    groupId,
    page,
    pageSize,
    {
      enabled: !!groupId,
      staleTime: 1000 * 60, // 1 minuto
    },
    actionFilter
  );

  // Filtrar logs por tipo de acción
  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];

    if (actionFilter === 'all') return data.logs;

    // Los logs ya están filtrados por el servidor cuando se usa la API directamente
    // pero mantenemos este filtro por si hay cambios locales o para compatibilidad
    return data.logs.filter(
      (log: any) => actionToGroup[log.action] === actionFilter
    );
  }, [data?.logs, actionFilter]);

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (data && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setPage(1); // Reset to first page when changing page size
  };

  const handleActionFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setActionFilter(e.target.value);
    setPage(1); // Reset to first page when changing filter
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500'></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className='bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 my-4 shadow-sm'>
        <p>Error al cargar los logs: {(error as Error).message}</p>
      </div>
    );
  }

  if (!data || !data.logs || data.logs.length === 0) {
    return (
      <div className='bg-white rounded-2xl p-8 text-center border border-primary-200 shadow-green-lg'>
        <div className='w-16 h-16 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
          <span className='text-2xl' role='img' aria-label='logs'>
            📝
          </span>
        </div>
        <h3 className='text-lg font-semibold text-gray-900 mb-3'>
          Sin actividad registrada
        </h3>
        <p className='text-primary-600 max-w-md mx-auto'>
          Las acciones del grupo aparecerán aquí cuando los miembros
          interactúen.
        </p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-2xl shadow-green-lg overflow-hidden border border-primary-200'>
      <div className='px-6 py-5 sm:px-6 border-b border-primary-200 bg-gradient-green-soft'>
        <div className='flex justify-between items-center'>
          <div>
            <h3 className='text-lg leading-6 font-semibold text-primary-800'>
              Registro de actividad
            </h3>
            <p className='mt-1 max-w-2xl text-sm text-primary-600'>
              Historial de acciones realizadas en el grupo
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className='flex items-center text-sm text-primary-700 hover:text-primary-800 px-3 py-2 rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors duration-200 bg-white'
          >
            <FunnelIcon className='h-4 w-4 mr-2' />
            Filtros
          </button>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className='mt-4 p-4 bg-primary-25 rounded-xl border border-primary-200'>
            <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4'>
              <div className='w-full sm:w-auto'>
                <label
                  htmlFor='action-filter'
                  className='block text-sm font-semibold text-primary-700 mb-2'
                >
                  Tipo de actividad
                </label>
                <select
                  id='action-filter'
                  value={actionFilter}
                  onChange={handleActionFilterChange}
                  className='w-full sm:w-auto block py-2 px-3 text-sm border border-primary-200 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white'
                >
                  {Object.entries(actionGroups).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='w-full sm:w-auto'>
                <label
                  htmlFor='page-size'
                  className='block text-sm font-semibold text-primary-700 mb-2'
                >
                  Registros por página
                </label>
                <select
                  id='page-size'
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className='w-full sm:w-auto block py-2 px-3 text-sm border border-primary-200 rounded-lg shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white'
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <ul className='divide-y divide-primary-100'>
        {filteredLogs.map((log: any) => {
          const date = new Date(log.createdAt);
          const timeAgo = formatDistanceToNow(date, {
            locale: es,
            addSuffix: true,
          });
          const formattedDate = format(date, 'dd/MM/yyyy HH:mm');

          // Obtener el mensaje de la acción según el tipo
          const getMessage =
            actionMessages[log.action] || (() => 'realizó una acción');
          const message = getMessage(log.details);

          return (
            <li
              key={log.id}
              className='py-4 px-6 hover:bg-primary-25 transition-colors duration-200'
            >
              <div className='flex items-center'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-baseline'>
                    <p
                      className='text-sm text-primary-600 font-medium mr-3'
                      title={formattedDate}
                    >
                      {formattedDate}:
                    </p>
                    <p className='text-sm'>
                      <span className='font-semibold text-primary-900'>
                        {log.user?.name || 'Usuario'}
                      </span>{' '}
                      <span className='text-primary-700'>
                        {renderFormattedText(message)}
                      </span>
                    </p>
                  </div>

                  {/* Mostrar detalles adicionales para ciertas acciones */}
                  {(log.action === LogAction.MATCH_RESULT_EDITED ||
                    log.action === LogAction.PLAYER_SWAPPED) &&
                    log.details && (
                      <div className='mt-2 pl-6 text-xs text-gray-500'>
                        <details>
                          <summary className='cursor-pointer hover:text-blue-600 font-medium'>
                            Ver más detalles
                          </summary>
                          <div className='mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200'>
                            {/* Información del partido */}
                            <div className='mb-3 pb-2 border-b border-blue-200'>
                              <p className='font-semibold text-blue-800 text-sm mb-1'>
                                📅 Información del Partido
                              </p>
                              <div className='space-y-1'>
                                {log.details.matchDate && (
                                  <p className='text-gray-700'>
                                    <span className='font-medium'>Fecha:</span>{' '}
                                    {new Date(
                                      log.details.matchDate
                                    ).toLocaleDateString('es-ES', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                )}
                                {log.details.matchLocation && (
                                  <p className='text-gray-700'>
                                    <span className='font-medium'>
                                      Ubicación:
                                    </span>{' '}
                                    {log.details.matchLocation}
                                  </p>
                                )}
                                {log.details.teamAName &&
                                  log.details.teamBName && (
                                    <p className='text-gray-700'>
                                      <span className='font-medium'>
                                        Equipos:
                                      </span>{' '}
                                      {log.details.teamAName} vs{' '}
                                      {log.details.teamBName}
                                    </p>
                                  )}
                              </div>
                            </div>

                            {/* Detalles específicos por tipo de acción */}
                            {log.action === LogAction.MATCH_RESULT_EDITED && (
                              <div>
                                <p className='font-semibold text-blue-800 text-sm mb-2'>
                                  ⚽ Cambios Realizados
                                </p>
                                {log.details.action === 'score_updated' &&
                                  log.details.previousScore &&
                                  log.details.newScore && (
                                    <div className='bg-white p-2 rounded border border-blue-100'>
                                      <p className='text-gray-700'>
                                        <span className='font-medium'>
                                          Resultado anterior:
                                        </span>{' '}
                                        <span className='bg-red-100 text-red-800 px-2 py-0.5 rounded'>
                                          {log.details.previousScore.scoreA} -{' '}
                                          {log.details.previousScore.scoreB}
                                        </span>
                                      </p>
                                      <p className='text-gray-700 mt-1'>
                                        <span className='font-medium'>
                                          Resultado nuevo:
                                        </span>{' '}
                                        <span className='bg-green-100 text-green-800 px-2 py-0.5 rounded'>
                                          {log.details.newScore.scoreA} -{' '}
                                          {log.details.newScore.scoreB}
                                        </span>
                                      </p>
                                    </div>
                                  )}
                                {log.details.action === 'goals_updated' &&
                                  log.details.goals && (
                                    <div className='bg-white p-2 rounded border border-blue-100'>
                                      <p className='font-medium text-gray-700 mb-1'>
                                        Goleadores:
                                      </p>
                                      <div className='grid grid-cols-2 gap-2'>
                                        <div>
                                          <p className='text-xs font-medium text-green-700'>
                                            {log.details.teamAName}:
                                          </p>
                                          <ul className='text-xs text-gray-600'>
                                            {log.details.goals
                                              .filter((g: any) => g.isTeamA)
                                              .map((goal: any, idx: number) => (
                                                <li key={idx}>
                                                  • {goal.scorerName}
                                                  {goal.minute
                                                    ? ` (${goal.minute}')`
                                                    : ''}
                                                </li>
                                              ))}
                                            {log.details.goals.filter(
                                              (g: any) => g.isTeamA
                                            ).length === 0 && (
                                              <li className='text-gray-400'>
                                                Sin goles
                                              </li>
                                            )}
                                          </ul>
                                        </div>
                                        <div>
                                          <p className='text-xs font-medium text-blue-700'>
                                            {log.details.teamBName}:
                                          </p>
                                          <ul className='text-xs text-gray-600'>
                                            {log.details.goals
                                              .filter((g: any) => !g.isTeamA)
                                              .map((goal: any, idx: number) => (
                                                <li key={idx}>
                                                  • {goal.scorerName}
                                                  {goal.minute
                                                    ? ` (${goal.minute}')`
                                                    : ''}
                                                </li>
                                              ))}
                                            {log.details.goals.filter(
                                              (g: any) => !g.isTeamA
                                            ).length === 0 && (
                                              <li className='text-gray-400'>
                                                Sin goles
                                              </li>
                                            )}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}

                            {log.action === LogAction.PLAYER_SWAPPED && (
                              <div>
                                <p className='font-semibold text-blue-800 text-sm mb-2'>
                                  🔄 Intercambio de Jugadores
                                </p>
                                <div className='bg-white p-2 rounded border border-blue-100 space-y-2'>
                                  <div className='flex items-center justify-between'>
                                    <div className='text-center flex-1'>
                                      <p className='font-medium text-gray-700'>
                                        {log.details.player1?.name}
                                      </p>
                                      <p className='text-xs text-gray-500'>
                                        Equipo{' '}
                                        {log.details.player1?.originalTeam} →
                                        Equipo {log.details.player1?.newTeam}
                                      </p>
                                    </div>
                                    <div className='px-2'>
                                      <span className='text-blue-500 font-bold'>
                                        ↔
                                      </span>
                                    </div>
                                    <div className='text-center flex-1'>
                                      <p className='font-medium text-gray-700'>
                                        {log.details.player2?.name}
                                      </p>
                                      <p className='text-xs text-gray-500'>
                                        Equipo{' '}
                                        {log.details.player2?.originalTeam} →
                                        Equipo {log.details.player2?.newTeam}
                                      </p>
                                    </div>
                                  </div>
                                  {log.details.resultUpdated && (
                                    <div className='pt-2 border-t border-gray-100'>
                                      <p className='text-xs font-medium text-gray-600 mb-1'>
                                        Cambio en el resultado:
                                      </p>
                                      <div className='flex items-center justify-center space-x-2'>
                                        <span className='bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs'>
                                          {
                                            log.details.resultUpdated
                                              .previousScore.scoreA
                                          }{' '}
                                          -{' '}
                                          {
                                            log.details.resultUpdated
                                              .previousScore.scoreB
                                          }
                                        </span>
                                        <span className='text-gray-400'>→</span>
                                        <span className='bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs'>
                                          {
                                            log.details.resultUpdated.newScore
                                              .scoreA
                                          }{' '}
                                          -{' '}
                                          {
                                            log.details.resultUpdated.newScore
                                              .scoreB
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                  {log.action === LogAction.TEAM_RESORTED &&
                    log.details.previousTeams && (
                      <div className='mt-2 pl-6 text-xs text-gray-500'>
                        <details>
                          <summary className='cursor-pointer hover:text-blue-600'>
                            Ver equipos (antes/después)
                          </summary>
                          <div className='mt-2 p-2 bg-gray-50 rounded-md'>
                            <p className='font-semibold'>Equipos anteriores:</p>
                            <div className='grid grid-cols-2 gap-2 mt-1'>
                              <div>
                                <p className='font-medium'>Equipo A:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.previousTeams.teamA.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.previousTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                            <p className='font-semibold mt-2'>
                              Nuevos equipos:
                            </p>
                            <div className='grid grid-cols-2 gap-2 mt-1'>
                              <div>
                                <p className='font-medium'>Equipo A:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamA.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                            {log.details.balancingCriteria && (
                              <div className='mt-3 pt-2 border-t border-gray-200'>
                                <p className='font-semibold text-xs'>
                                  Criterios de balanceo:
                                </p>
                                <div className='mt-1 text-xs'>
                                  {log.details.balancingCriteria.byAge && (
                                    <span className='inline-block bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por edad
                                    </span>
                                  )}
                                  {log.details.balancingCriteria.byRole && (
                                    <span className='inline-block bg-green-100 text-green-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por posición
                                    </span>
                                  )}
                                  {log.details.balancingCriteria.byRating && (
                                    <span className='inline-block bg-purple-100 text-purple-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por habilidad
                                    </span>
                                  )}
                                  {!log.details.balancingCriteria.byAge &&
                                    !log.details.balancingCriteria.byRole &&
                                    !log.details.balancingCriteria.byRating && (
                                      <span className='inline-block bg-gray-100 text-gray-800 rounded-full px-2 py-0.5 text-xs'>
                                        Aleatorio
                                      </span>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                  {log.action === LogAction.TEAM_SORTED &&
                    log.details.newTeams && (
                      <div className='mt-2 pl-6 text-xs text-gray-500'>
                        <details>
                          <summary className='cursor-pointer hover:text-blue-600'>
                            Ver equipos
                          </summary>
                          <div className='mt-2 p-2 bg-gray-50 rounded-md'>
                            <div className='grid grid-cols-2 gap-2 mt-1'>
                              <div>
                                <p className='font-medium'>Equipo A:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamA.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>
                                        {player.name}
                                        {player.role && (
                                          <span className='text-gray-500 ml-1'>
                                            ({player.role})
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                            {log.details.balancingCriteria && (
                              <div className='mt-3 pt-2 border-t border-gray-200'>
                                <p className='font-semibold text-xs'>
                                  Criterios de balanceo:
                                </p>
                                <div className='mt-1 text-xs'>
                                  {log.details.balancingCriteria.byAge && (
                                    <span className='inline-block bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por edad
                                    </span>
                                  )}
                                  {log.details.balancingCriteria.byRole && (
                                    <span className='inline-block bg-green-100 text-green-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por posición
                                    </span>
                                  )}
                                  {log.details.balancingCriteria.byRating && (
                                    <span className='inline-block bg-purple-100 text-purple-800 rounded-full px-2 py-0.5 text-xs mr-2'>
                                      Balanceo por habilidad
                                    </span>
                                  )}
                                  {!log.details.balancingCriteria.byAge &&
                                    !log.details.balancingCriteria.byRole &&
                                    !log.details.balancingCriteria.byRating && (
                                      <span className='inline-block bg-gray-100 text-gray-800 rounded-full px-2 py-0.5 text-xs'>
                                        Aleatorio
                                      </span>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                  {log.action === LogAction.MATCH_COMPLETED &&
                    log.details.goals && (
                      <div className='mt-2 pl-6 text-xs text-gray-500'>
                        <details>
                          <summary className='cursor-pointer hover:text-blue-600'>
                            Ver goles
                          </summary>
                          <div className='mt-2 p-2 bg-gray-50 rounded-md'>
                            {log.details.goals.length > 0 ? (
                              <>
                                <p className='font-semibold'>Goles:</p>
                                <ul className='list-disc pl-5 mt-1'>
                                  {log.details.scorers
                                    ? // Use the specialized scorers field if available
                                      log.details.scorers.map(
                                        (scorer: any, index: number) => (
                                          <li key={index}>
                                            {scorer.name} ({scorer.team})
                                          </li>
                                        )
                                      )
                                    : // Fallback to the old format
                                      log.details.goals.map(
                                        (goal: any, index: number) => (
                                          <li key={index}>
                                            {goal.name ||
                                              goal.playerName ||
                                              'Desconocido'}{' '}
                                            (
                                            {goal.team ||
                                              (goal.isTeamA
                                                ? log.details.teamAName
                                                : log.details.teamBName)}
                                            )
                                            {goal.minute
                                              ? ` - Minuto ${goal.minute}`
                                              : ''}
                                          </li>
                                        )
                                      )}
                                </ul>
                              </>
                            ) : (
                              <p>No se registraron goles</p>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Paginación */}
      {data.pagination.totalPages > 1 && (
        <div className='px-4 py-3 bg-gray-50 text-right sm:px-6 flex justify-between items-center'>
          <div className='text-sm text-gray-700'>
            Mostrando <span className='font-medium'>{filteredLogs.length}</span>{' '}
            de <span className='font-medium'>{data.pagination.totalItems}</span>{' '}
            registros
          </div>
          <div className='flex-1 flex justify-end'>
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white ${
                page === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              } mr-3`}
            >
              Anterior
            </button>
            <button
              onClick={handleNextPage}
              disabled={!data || page >= data.pagination.totalPages}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white ${
                !data || page >= data.pagination.totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsTab;
