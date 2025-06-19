import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AddGhostPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, age: number) => Promise<void>;
  isLoading?: boolean;
}

export default function AddGhostPlayerModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: AddGhostPlayerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    const age = parseInt(formData.age);
    if (isNaN(age) || age < 12 || age > 100) {
      setError('La edad debe estar entre 12 y 100 años');
      return;
    }

    try {
      await onConfirm(formData.name.trim(), age);
      // Limpiar formulario y cerrar modal
      setFormData({ name: '', age: '' });
      setError('');
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Error al crear jugador'
      );
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ name: '', age: '' });
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0'>
        {/* Overlay */}
        <div
          className='fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity'
          onClick={handleClose}
        />

        {/* Modal */}
        <div className='relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg'>
          <div className='bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4'>
            {/* Header */}
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>
                Agregar Jugador Fantasma
              </h3>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className='rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
              >
                <XMarkIcon className='h-6 w-6' />
              </button>
            </div>

            {/* Description */}
            <p className='text-sm text-gray-600 mb-4'>
              Los jugadores fantasma son usuarios temporales que solo existirán
              en este grupo. Se marcarán con{' '}
              <span className='font-semibold'>(F)</span> y se eliminarán
              automáticamente cuando los quites del grupo.
            </p>

            {/* Error */}
            {error && (
              <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
                <p className='text-sm text-red-600'>{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Nombre del jugador *
                </label>
                <input
                  type='text'
                  id='name'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Ej: Juan Pérez'
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor='age'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Edad *
                </label>
                <input
                  type='number'
                  id='age'
                  min='12'
                  max='100'
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Ej: 25'
                  disabled={isLoading}
                  required
                />
                <p className='mt-1 text-xs text-gray-500'>
                  Se establecerá la fecha de nacimiento como 1 de enero del año
                  correspondiente
                </p>
              </div>

              {/* Buttons */}
              <div className='flex gap-3 pt-4'>
                <button
                  type='button'
                  onClick={handleClose}
                  disabled={isLoading}
                  className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
                >
                  Cancelar
                </button>
                <button
                  type='submit'
                  disabled={isLoading}
                  className='flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isLoading ? (
                    <div className='flex items-center justify-center'>
                      <div className='animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white'></div>
                      <span className='ml-2'>Creando...</span>
                    </div>
                  ) : (
                    'Crear Jugador'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
