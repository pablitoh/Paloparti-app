import React, { useEffect } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface LeaveGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  groupName: string;
  isLeaving?: boolean;
}

const LeaveGroupModal: React.FC<LeaveGroupModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  groupName,
  isLeaving = false,
}) => {
  // Handle body scroll when modal is open
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
      <div className='fixed inset-0 bg-black opacity-50' onClick={onClose} />

      {/* Modal content */}
      <div className='relative z-10 bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4'>
        <div className='flex justify-between items-start mb-4'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <ExclamationTriangleIcon className='h-6 w-6 text-orange-600' />
            </div>
            <h3 className='ml-3 text-lg font-medium leading-6 text-gray-900'>
              Salir del grupo
            </h3>
          </div>
          <button
            type='button'
            className='text-gray-400 hover:text-gray-500 focus:outline-none'
            onClick={onClose}
            disabled={isLeaving}
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='mt-2'>
          <div className='bg-orange-50 border border-orange-200 rounded-md p-4 mb-4'>
            <p className='text-sm text-orange-800'>
              ¿Estás seguro de que quieres salir del grupo{' '}
              <strong>"{groupName}"</strong>?
            </p>
            <p className='text-sm text-orange-700 mt-2'>
              Perderás acceso a los partidos y tendrás que solicitar unirte
              nuevamente si cambias de opinión.
            </p>
          </div>
        </div>

        <div className='mt-6 flex justify-end space-x-3'>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none disabled:opacity-50'
            onClick={onClose}
            disabled={isLeaving}
          >
            Cancelar
          </button>
          <button
            type='button'
            className='inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none disabled:opacity-50'
            onClick={onConfirm}
            disabled={isLeaving}
          >
            {isLeaving ? (
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
                Saliendo...
              </span>
            ) : (
              'Salir del grupo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveGroupModal;
