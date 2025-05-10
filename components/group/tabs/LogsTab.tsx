import { useState } from 'react';
import { useGroupLogs } from '../../../services/groupHooks';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar } from '@mui/material';
import { LogAction } from '../../../utils/logTypes';

interface LogsTabProps {
  groupId: string;
}

// Mapeo de tipos de acción a mensajes legibles
const actionMessages: Record<string, (details: any) => string> = {
  [LogAction.TEAM_SORTED]: () => 'formó equipos',
  [LogAction.TEAM_RESORTED]: () => 'reordenó los equipos',
  [LogAction.MATCH_DELETED]: () => 'eliminó un partido',
  [LogAction.MATCH_CREATED]: () => 'creó un nuevo partido',
  [LogAction.PLAYER_REPLACED]: (details) =>
    `reemplazó a ${details.oldPlayer?.name || 'TBD'} por ${
      details.newPlayer?.name || 'un jugador'
    }`,
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
    `actualizó la asistencia de ${details.userName || 'un jugador'} a "${
      details.status === 'CONFIRMED'
        ? 'Confirmado'
        : details.status === 'DECLINED'
        ? 'No asistirá'
        : 'Pendiente'
    }"`,
  [LogAction.USER_ROLE_CHANGED]: (details) =>
    `cambió el rol de ${details.targetUser?.name || 'un usuario'} a ${
      details.newRole === 'ADMIN' ? 'Administrador' : 'Miembro'
    }`,
  [LogAction.MATCH_RESULT_ADDED]: () => 'añadió el resultado del partido',
  [LogAction.MATCH_RESULT_EDITED]: () => 'editó el resultado del partido',
  [LogAction.MATCH_COMPLETED]: (details) =>
    `registró el resultado final del partido: ${details.teamAName} ${details.scoreA} - ${details.scoreB} ${details.teamBName}`,
};

const LogsTab: React.FC<LogsTabProps> = ({ groupId }) => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useGroupLogs(groupId, page, 10, {
    enabled: !!groupId,
    staleTime: 1000 * 60, // 1 minuto
  });

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

  if (isLoading) {
    return (
      <div className='flex justify-center items-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className='bg-red-50 border border-red-200 text-red-800 rounded-md p-4 my-4'>
        <p>Error al cargar los logs: {(error as Error).message}</p>
      </div>
    );
  }

  if (!data || !data.logs || data.logs.length === 0) {
    return (
      <div className='text-center p-8 text-gray-500'>
        <p>No hay actividad registrada en este grupo todavía.</p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg shadow overflow-hidden'>
      <div className='px-4 py-5 sm:px-6 border-b border-gray-200'>
        <h3 className='text-lg leading-6 font-medium text-gray-900'>
          Registro de actividad
        </h3>
        <p className='mt-1 max-w-2xl text-sm text-gray-500'>
          Historial de acciones realizadas en el grupo
        </p>
      </div>

      <ul className='divide-y divide-gray-200'>
        {data.logs.map((log: any) => {
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
              className='py-3 px-6 hover:bg-gray-50 transition-colors duration-150'
            >
              <div className='flex items-center'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-baseline'>
                    <p
                      className='text-sm text-gray-500 mr-3'
                      title={formattedDate}
                    >
                      {formattedDate}:
                    </p>
                    <p className='text-sm'>
                      <span className='font-medium text-gray-900'>
                        {log.user?.name || 'Usuario'}
                      </span>{' '}
                      <span className='text-gray-600'>{message}</span>
                    </p>
                  </div>

                  {/* Mostrar detalles adicionales para ciertas acciones */}
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
                                      <li key={player.id}>{player.name}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.previousTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>{player.name}</li>
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
                                      <li key={player.id}>{player.name}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>{player.name}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
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
                                      <li key={player.id}>{player.name}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className='font-medium'>Equipo B:</p>
                                <ul className='list-disc pl-5'>
                                  {log.details.newTeams.teamB.map(
                                    (player: any) => (
                                      <li key={player.id}>{player.name}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
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
            Mostrando <span className='font-medium'>{data.logs.length}</span> de{' '}
            <span className='font-medium'>{data.pagination.totalItems}</span>{' '}
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
