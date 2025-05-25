import React, { useEffect, useState } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  groupName: string;
  isDeleting?: boolean;
}

const DeleteGroupModal: React.FC<DeleteGroupModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  groupName,
  isDeleting = false,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const expectedText = 'ELIMINAR';
  const isConfirmValid = confirmText === expectedText;

  // Reset confirm text when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleConfirm = () => {
    if (isConfirmValid && !isDeleting) {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* Overlay */}
      <div className='fixed inset-0 bg-black opacity-50' onClick={onClose} />

      {/* Modal content */}
      <div className='relative z-10 bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4'>
        <div className='flex justify-between items-start mb-4'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <ExclamationTriangleIcon className='h-6 w-6 text-red-600' />
            </div>
            <h3 className='ml-3 text-lg font-medium leading-6 text-gray-900'>
              Eliminar grupo
            </h3>
          </div>
          <button
            type='button'
            className='text-gray-400 hover:text-gray-500 focus:outline-none'
            onClick={onClose}
            disabled={isDeleting}
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='mt-2'>
          <div className='bg-red-50 border border-red-200 rounded-md p-4 mb-4'>
            <p className='text-sm text-red-800 font-medium mb-2'>
              ⚠️ Esta acción es irreversible
            </p>
            <p className='text-sm text-red-700'>
              Se eliminará permanentemente el grupo{' '}
              <strong>"{groupName}"</strong> y todos sus datos asociados:
            </p>
            <ul className='text-sm text-red-700 mt-2 ml-4 list-disc'>
              <li>Todos los partidos y resultados</li>
              <li>Historial de asistencias</li>
              <li>Estadísticas y logs</li>
              <li>Lista de miembros</li>
            </ul>
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Para confirmar, escribe <strong>ELIMINAR</strong> en el campo de
              abajo:
            </label>
            <input
              type='text'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500'
              placeholder='Escribe ELIMINAR'
              disabled={isDeleting}
            />
          </div>
        </div>

        <div className='mt-6 flex justify-end space-x-3'>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none disabled:opacity-50'
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type='button'
            className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none disabled:opacity-50 ${
              isConfirmValid && !isDeleting
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
          >
            {isDeleting ? (
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
                Eliminando...
              </span>
            ) : (
              'Eliminar grupo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteGroupModal;
