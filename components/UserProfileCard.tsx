import React from 'react';
import { calculateAge } from '../lib/utils';

interface UserProfileCardProps {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    birthdate: Date | string | null;
    email?: string | null;
    position?: string | null;
  };
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user }) => {
  const formatBirthdate = (date: Date | string | null) => {
    if (!date) return 'No disponible';
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className='bg-white rounded-xl shadow-md p-6'>
      <div className='flex items-start gap-6'>
        <div className='w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden'>
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || 'Usuario'}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-3xl text-gray-400'>👤</span>
          )}
        </div>
        <div className='flex-1'>
          <h2 className='text-xl font-semibold text-gray-800'>
            {user.name || 'Usuario'}
          </h2>
          {user.email && <p className='text-gray-600'>{user.email}</p>}
          <div className='mt-2'>
            <p className='text-gray-600'>
              <span className='font-medium'>Edad:</span>{' '}
              {calculateAge(user.birthdate) || 'No disponible'} años
            </p>
            <p className='text-gray-600'>
              <span className='font-medium'>Fecha de nacimiento:</span>{' '}
              {formatBirthdate(user.birthdate)}
            </p>
            {user.position && (
              <p className='text-gray-600'>
                <span className='font-medium'>Posición:</span> {user.position}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard;
