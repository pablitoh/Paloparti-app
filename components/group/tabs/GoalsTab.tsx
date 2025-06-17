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
        <div className='bg-white rounded-2xl border border-primary-200 shadow-green-lg overflow-hidden'>
          <div className='bg-gradient-green-soft px-6 py-4 border-b border-primary-200'>
            <div className='grid grid-cols-12 gap-4'>
              <div className='col-span-1'>
                <span className='text-xs font-semibold text-primary-700 uppercase tracking-wide'>
                  Pos.
                </span>
              </div>
              <div className='col-span-7'>
                <span className='text-xs font-semibold text-primary-700 uppercase tracking-wide'>
                  Jugador
                </span>
              </div>
              <div className='col-span-4 text-center'>
                <span className='text-xs font-semibold text-primary-700 uppercase tracking-wide'>
                  Goles
                </span>
              </div>
            </div>
          </div>

          <div className='divide-y divide-primary-100'>
            {goleadores.map((goleador, index) => (
              <div
                key={goleador.id}
                className={`px-6 py-4 hover:bg-primary-50 transition-all duration-200 ${
                  index < 3 ? 'bg-gradient-to-r from-primary-25 to-white' : ''
                }`}
              >
                <div className='grid grid-cols-12 gap-4 items-center'>
                  <div className='col-span-1'>
                    <div
                      className={`
                          flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm shadow-sm
                          ${
                            index === 0
                              ? 'bg-gradient-green text-white shadow-green'
                              : index === 1
                              ? 'bg-primary-100 text-primary-700 border-2 border-primary-200'
                              : index === 2
                              ? 'bg-primary-50 text-primary-600 border border-primary-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }
                        `}
                    >
                      <span>{index + 1}</span>
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
                    <div className='flex items-center justify-center space-x-2'>
                      <span className='text-lg font-bold text-gray-900'>
                        {goleador.goals}
                      </span>
                      <span role='img' aria-label='goal' className='text-lg'>
                        ⚽
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className='bg-white rounded-2xl p-8 text-center border border-primary-200 shadow-green-lg'>
          <div className='w-16 h-16 bg-gradient-green-light rounded-full flex items-center justify-center mx-auto mb-6'>
            <span className='text-2xl' role='img' aria-label='soccer ball'>
              ⚽
            </span>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            No hay goleadores aún
          </h3>
          <p className='text-primary-600 max-w-md mx-auto'>
            Los goles se registrarán automáticamente cuando se completen los
            partidos.
          </p>
        </div>
      )}
    </div>
  );
}
