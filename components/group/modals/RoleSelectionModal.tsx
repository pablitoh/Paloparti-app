import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
  onConfirm: (roles: string[]) => void;
  playerName: string;
  initialRoles?: string[];
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  playerName,
  initialRoles = [],
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manejar la selección/deselección de roles
  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleConfirm = () => {
    setIsSubmitting(true);

    // Si no hay roles seleccionados, usar Comodín por defecto
    const rolesToSubmit =
      selectedRoles.length > 0 ? selectedRoles : [PLAYER_ROLES.WILDCARD];

    onConfirm(rolesToSubmit);
    setIsSubmitting(false);
    onClose();
  };

  // Usar useEffect para manejar el scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* Overlay */}
      <div className='fixed inset-0 bg-black opacity-40' onClick={onClose} />

      {/* Modal content */}
      <div className='relative z-10 bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-lg font-medium leading-6 text-gray-900'>
            Seleccionar roles para {playerName}
          </h3>
          <button
            type='button'
            className='text-gray-400 hover:text-gray-500 focus:outline-none'
            onClick={onClose}
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='mt-2'>
          <p className='text-sm text-gray-500 mb-4'>
            Selecciona una o más posiciones para este jugador. Si no seleccionas
            ninguna, se le asignará rol de Comodín.
          </p>

          <div className='flex flex-wrap gap-2 mb-4'>
            {Object.values(PLAYER_ROLES).map((role) => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`px-3 py-2 text-sm rounded-md transition ${
                  selectedRoles.includes(role)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className='text-sm text-gray-600 mb-6'>
            <strong>Roles seleccionados:</strong>{' '}
            {selectedRoles.length > 0
              ? selectedRoles.join(', ')
              : 'Ninguno (se asignará Comodín)'}
          </div>
        </div>

        <div className='mt-4 flex justify-end space-x-3'>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none'
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none'
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionModal;
