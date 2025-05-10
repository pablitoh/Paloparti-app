import { Avatar } from '@mui/material';
import type { Player } from '../../../types/group';

interface GoleadorData extends Player {
  goals: number;
}

interface GoalsTabProps {
  goleadores: GoleadorData[];
}

export default function GoalsTab({ goleadores }: GoalsTabProps) {
  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-semibold text-gray-900'>
          Tabla de goleadores
        </h3>
        <span className='text-sm text-gray-500'>
          {goleadores.length} jugadores
        </span>
      </div>

      {goleadores && goleadores.length > 0 ? (
        <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
          <div className='bg-gray-50 px-6 py-3 border-b border-gray-200'>
            <div className='grid grid-cols-12 gap-4'>
              <div className='col-span-1'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Pos.
                </span>
              </div>
              <div className='col-span-7'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Jugador
                </span>
              </div>
              <div className='col-span-4 text-center'>
                <span className='text-xs font-medium text-gray-500 uppercase'>
                  Goles
                </span>
              </div>
            </div>
          </div>

          <div className='divide-y divide-gray-200'>
            {goleadores.map((goleador, index) => (
              <div
                key={goleador.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  index < 3 ? 'bg-gradient-to-r from-amber-50 to-white' : ''
                }`}
              >
                <div className='grid grid-cols-12 gap-4 items-center'>
                  <div className='col-span-1'>
                    <div
                      className={`
                          flex items-center justify-center w-8 h-8 rounded-full
                          ${
                            index === 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : index === 1
                              ? 'bg-gray-100 text-gray-600'
                              : index === 2
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-50 text-blue-600'
                          }
                        `}
                    >
                      <span className='text-sm font-semibold'>{index + 1}</span>
                    </div>
                  </div>
                  <div className='col-span-7'>
                    <div className='flex items-center'>
                      <div className='flex-shrink-0'>
                        <Avatar
                          alt={goleador.name || ''}
                          src={goleador.avatar || ''}
                          className='h-9 w-9 rounded-full'
                        />
                      </div>
                      <div className='ml-3'>
                        <p className='text-sm font-medium text-gray-900'>
                          {goleador.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='col-span-4 text-center'>
                    <div className='flex items-center justify-center space-x-1'>
                      <span className='text-sm font-semibold text-gray-900'>
                        {goleador.goals}
                      </span>
                      <div className='flex'>
                        {Array.from({
                          length: Math.min(goleador.goals, 5),
                        }).map((_, i) => (
                          <span
                            key={i}
                            role='img'
                            aria-label='goal'
                            className='text-sm'
                          >
                            ⚽
                          </span>
                        ))}
                        {goleador.goals > 5 && (
                          <span className='text-xs text-gray-500 ml-1'>
                            +{goleador.goals - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
              d='M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            No hay datos de goleadores
          </h3>
          <p className='text-gray-500 max-w-md mx-auto'>
            Aún no se han registrado goles o no se han jugado suficientes
            partidos para mostrar estadísticas.
          </p>
        </div>
      )}
    </div>
  );
}
