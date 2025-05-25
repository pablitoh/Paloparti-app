import React, { useState } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface DeleteMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  matchDate?: string;
  isDeleting?: boolean;
}

const DeleteMatchModal: React.FC<DeleteMatchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matchDate,
  isDeleting = false,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const requiredText = 'ELIMINAR';

  const handleConfirm = async () => {
    if (confirmText === requiredText) {
      await onConfirm();
      setConfirmText('');
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0'>
        {/* Background overlay */}
        <div
          className='fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity'
          onClick={handleClose}
        />

        {/* Modal panel */}
        <div className='inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6'>
          <div className='sm:flex sm:items-start'>
            <div className='mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10'>
              <ExclamationTriangleIcon className='h-6 w-6 text-red-600' />
            </div>
            <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1'>
              <h3 className='text-lg leading-6 font-medium text-gray-900'>
                Eliminar partido
              </h3>
              <div className='mt-2'>
                <p className='text-sm text-gray-500'>
                  ¿Estás seguro de que quieres eliminar este partido
                  {matchDate ? ` del ${matchDate}` : ''}?
                </p>
                <div className='mt-3 p-3 bg-red-50 rounded-md'>
                  <p className='text-sm text-red-800 font-medium'>
                    ⚠️ Esta acción eliminará permanentemente:
                  </p>
                  <ul className='mt-2 text-sm text-red-700 list-disc list-inside space-y-1'>
                    <li>Todos los equipos formados</li>
                    <li>Las confirmaciones de asistencia</li>
                    <li>Los goles registrados (si los hay)</li>
                    <li>Todo el historial del partido</li>
                  </ul>
                </div>
                <div className='mt-4'>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Para confirmar, escribe{' '}
                    <span className='font-bold text-red-600'>
                      {requiredText}
                    </span>
                    :
                  </label>
                  <input
                    type='text'
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    placeholder={requiredText}
                    disabled={isDeleting}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className='absolute top-4 right-4 text-gray-400 hover:text-gray-600'
              disabled={isDeleting}
            >
              <XMarkIcon className='h-6 w-6' />
            </button>
          </div>
          <div className='mt-5 sm:mt-4 sm:flex sm:flex-row-reverse'>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={confirmText !== requiredText || isDeleting}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm ${
                confirmText === requiredText && !isDeleting
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
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
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    />
                  </svg>
                  Eliminando...
                </span>
              ) : (
                'Eliminar partido'
              )}
            </button>
            <button
              type='button'
              onClick={handleClose}
              disabled={isDeleting}
              className='mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm'
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteMatchModal;
