import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface BirthdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BirthdateModal({
  isOpen,
  onClose,
  onSuccess,
}: BirthdateModalProps) {
  const [birthdate, setBirthdate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Calcular la fecha máxima permitida (12 años atrás desde hoy)
  const getMaxDate = () => {
    const today = new Date();
    const maxDate = new Date(
      today.getFullYear() - 12,
      today.getMonth(),
      today.getDate()
    );
    return maxDate.toISOString().split('T')[0];
  };

  // Calcular la fecha mínima permitida (100 años atrás desde hoy)
  const getMinDate = () => {
    const today = new Date();
    const minDate = new Date(
      today.getFullYear() - 100,
      today.getMonth(),
      today.getDate()
    );
    return minDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/profile/birthdate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ birthdate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Error al actualizar fecha de nacimiento'
        );
      }

      toast.success('Fecha de nacimiento guardada correctamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const isValidAge = () => {
    if (!birthdate) return true;
    const age = calculateAge(birthdate);
    return age >= 12 && age <= 100;
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-2xl p-6 max-w-md w-full'>
        <div className='text-center mb-6'>
          <div className='w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-8 h-8 text-primary-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4h.01M12 15h.01M16 15h.01m-6 4h.01M12 19h.01M16 19h.01'
              />
            </svg>
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-2'>
            Completa tu perfil
          </h2>
          <p className='text-gray-600'>
            Necesitamos tu fecha de nacimiento para organizar mejor los equipos
            y validar tu edad
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='birthdate'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Fecha de nacimiento *
            </label>
            <input
              type='date'
              id='birthdate'
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              required
            />
            <p className='text-xs text-gray-500 mt-1'>
              Debes tener entre 12 y 100 años para usar la aplicación
            </p>
            {birthdate && !isValidAge() && (
              <p className='text-sm text-red-600 mt-1'>
                La fecha seleccionada no es válida. Debes tener entre 12 y 100
                años.
              </p>
            )}
          </div>

          <div className='pt-4'>
            <button
              type='submit'
              disabled={isLoading || !birthdate || !isValidAge()}
              className='w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {isLoading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
