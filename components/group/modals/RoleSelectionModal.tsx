import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { POSITION_CONFIG } from '../../../lib/teambuilder';
import { PlayerRole, PlayerRoleType } from '../../../lib/teambuilder/types';

// Constantes para roles de jugadores
export const PLAYER_ROLES = {
  GOALKEEPER: 'Arquero',
  DEFENDER: 'Defensor',
  MIDFIELDER: 'Mediocampo',
  FORWARD: 'Delantero',
  WILDCARD: 'Comodín',
};

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (roles: PlayerRole[]) => void;
  playerName: string;
  initialRoles?: PlayerRole[];
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  playerName,
  initialRoles = [],
}) => {
  const [selectedRoles, setSelectedRoles] =
    useState<PlayerRole[]>(initialRoles);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nueva lógica para manejar clicks en roles con prioridades
  const handleRoleClick = (role: PlayerRoleType) => {
    const currentRoleIndex = selectedRoles.findIndex((r) => r.role === role);

    if (currentRoleIndex === -1) {
      // Rol no seleccionado - agregarlo con la siguiente prioridad disponible
      if (selectedRoles.length < POSITION_CONFIG.MAX_POSITIONS) {
        const nextPriority = selectedRoles.length + 1;
        setSelectedRoles((prev) => [...prev, { role, priority: nextPriority }]);
      }
    } else {
      // Rol ya seleccionado - removerlo y reajustar prioridades
      const newRoles = selectedRoles.filter((r) => r.role !== role);
      // Reajustar prioridades para que sean consecutivas
      const adjustedRoles = newRoles.map((r, index) => ({
        ...r,
        priority: index + 1,
      }));
      setSelectedRoles(adjustedRoles);
    }
  };

  // Obtener la prioridad de un rol
  const getRolePriority = (role: PlayerRoleType): number | undefined => {
    const roleData = selectedRoles.find((r) => r.role === role);
    return roleData?.priority;
  };

  // Verificar si un rol está seleccionado
  const isRoleSelected = (role: PlayerRoleType): boolean => {
    return selectedRoles.some((r) => r.role === role);
  };

  const handleConfirm = () => {
    setIsSubmitting(true);

    // Si no hay roles seleccionados, usar Comodín por defecto
    const rolesToSubmit =
      selectedRoles.length > 0
        ? selectedRoles
        : [{ role: PLAYER_ROLES.WILDCARD as PlayerRoleType, priority: 1 }];

    onConfirm(rolesToSubmit);
    setIsSubmitting(false);
    onClose();
  };

  // Resetear roles cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedRoles(initialRoles);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialRoles]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* Overlay con gradiente */}
      <div
        className='fixed inset-0 bg-gradient-to-br from-black/40 to-black/60 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* Modal content con nueva estética */}
      <div className='relative z-10 bg-white rounded-2xl shadow-green-xl w-full max-w-md mx-4 border border-primary-200 overflow-hidden'>
        {/* Header con gradiente */}
        <div className='bg-gradient-green-soft px-6 py-4 border-b border-primary-200'>
          <div className='flex justify-between items-center'>
            <h3 className='text-lg font-semibold text-primary-900'>
              Seleccionar posiciones
            </h3>
            <button
              type='button'
              className='text-primary-400 hover:text-primary-600 focus:outline-none transition-colors duration-200 p-1 rounded-full hover:bg-primary-100'
              onClick={onClose}
            >
              <XMarkIcon className='h-5 w-5' />
            </button>
          </div>
          <p className='text-sm text-primary-700 mt-1'>
            Para <span className='font-medium'>{playerName}</span>
          </p>
        </div>

        <div className='p-6'>
          <div className='mb-4'>
            <p className='text-xs text-primary-600 mb-4'>
              Selecciona {POSITION_CONFIG.MIN_POSITIONS} posiciones por orden de
              prioridad
            </p>

            {/* Selector de roles con nueva estética */}
            <div className='grid grid-cols-2 gap-3 mb-4'>
              {Object.entries(PLAYER_ROLES).map(
                ([key, role]) =>
                  key !== 'WILDCARD' && (
                    <button
                      key={role}
                      onClick={() => handleRoleClick(role as PlayerRoleType)}
                      className={`relative px-3 py-3 text-sm rounded-xl transition-all duration-200 flex items-center justify-center font-medium border-2 ${
                        isRoleSelected(role as PlayerRoleType)
                          ? 'bg-gradient-green-light text-primary-800 border-primary-300 shadow-green-sm'
                          : 'bg-white text-primary-700 hover:bg-primary-25 border-primary-200 hover:border-primary-300'
                      }`}
                    >
                      {/* Número de prioridad */}
                      {isRoleSelected(role as PlayerRoleType) && (
                        <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm'>
                          {getRolePriority(role as PlayerRoleType)}
                        </span>
                      )}

                      {/* Iconos y texto */}
                      <div className='flex flex-col items-center'>
                        <span className='text-lg mb-1'>
                          {key === 'GOALKEEPER' && '🧤'}
                          {key === 'DEFENDER' && '🛡️'}
                          {key === 'MIDFIELDER' && '⚽'}
                          {key === 'FORWARD' && '👟'}
                        </span>
                        <span className='text-xs leading-tight text-center'>
                          {role}
                        </span>
                      </div>
                    </button>
                  )
              )}
            </div>

            {/* Feedback visual de selección */}
            <div className='bg-primary-25 rounded-xl p-3 border border-primary-200'>
              <div className='text-sm text-primary-700'>
                <strong>Posiciones seleccionadas:</strong>
              </div>
              <div className='text-sm text-primary-600 mt-1'>
                {selectedRoles.length > 0 ? (
                  selectedRoles
                    .sort((a, b) => a.priority - b.priority)
                    .map((r) => `${r.priority}° ${r.role}`)
                    .join(', ')
                ) : (
                  <span className='text-primary-400'>
                    Selecciona al menos {POSITION_CONFIG.MIN_POSITIONS}{' '}
                    posiciones
                  </span>
                )}
              </div>

              {/* Indicador de progreso */}
              <div className='mt-2'>
                <div className='flex justify-between text-xs text-primary-600 mb-1'>
                  <span>Progreso</span>
                  <span>
                    {selectedRoles.length}/{POSITION_CONFIG.MIN_POSITIONS}
                  </span>
                </div>
                <div className='w-full bg-primary-100 rounded-full h-2'>
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      selectedRoles.length >= POSITION_CONFIG.MIN_POSITIONS
                        ? 'bg-gradient-green'
                        : 'bg-primary-300'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedRoles.length / POSITION_CONFIG.MIN_POSITIONS) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botones mejorados */}
        <div className='bg-primary-25 px-6 py-4 border-t border-primary-200 flex justify-end space-x-3'>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-lg hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200'
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type='button'
            className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
              selectedRoles.length >= POSITION_CONFIG.MIN_POSITIONS
                ? 'bg-gradient-green hover:shadow-green-md focus:ring-primary-500'
                : 'bg-primary-300 cursor-not-allowed'
            }`}
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              selectedRoles.length < POSITION_CONFIG.MIN_POSITIONS
            }
          >
            {isSubmitting ? (
              <span className='flex items-center'>
                <svg
                  className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                Confirmando...
              </span>
            ) : (
              'Confirmar Asistencia'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionModal;
