import React, { useState } from 'react';
import { useRouter } from 'next/router';

interface GroupCardProps {
  id: string;
  name: string;
  sport: string;
  membersCount: number;
  nextMatch?: string;
  description?: string;
  location?: string;
  userStatus?: string;
  isAdmin?: boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({
  id,
  name,
  sport,
  membersCount,
  nextMatch,
  description,
  location,
  userStatus = 'CONFIRMED',
  isAdmin = false,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (userStatus === 'PENDING') return;
    setIsLoading(true);
    await router.push(`/group/${id}`);
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-green-lg p-6 transition-all duration-200 transform hover:scale-105 relative
        ${
          userStatus !== 'PENDING'
            ? 'hover:shadow-green cursor-pointer'
            : 'opacity-90 cursor-default'
        }
        ${isLoading ? 'opacity-50' : ''}`}
      onClick={handleClick}
    >
      {isLoading && (
        <div className='absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-2xl z-10'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500'></div>
        </div>
      )}

      {userStatus === 'PENDING' && (
        <div className='flex items-center justify-end mb-4'>
          <span className='px-3 py-1 text-xs font-medium text-warning-700 bg-warning-100 rounded-full'>
            Pendiente
          </span>
        </div>
      )}

      <div className='mb-4'>
        <div className='flex items-center gap-2 mb-2'>
          <h2 className='text-xl font-bold text-gray-900'>{name}</h2>
          {isAdmin && (
            <span className='px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full'>
              Admin
            </span>
          )}
        </div>
        {description && (
          <p className='text-gray-600 text-sm mb-3 line-clamp-2'>
            {description}
          </p>
        )}
      </div>

      <div className='flex items-center gap-4 text-sm text-gray-600'>
        <div className='flex items-center gap-1'>
          <svg
            className='w-4 h-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
            />
          </svg>
          <span>{membersCount}</span>
        </div>
        <div className='flex items-center gap-1'>
          <svg
            className='w-4 h-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
          <span>{sport}</span>
        </div>
        {location && (
          <div className='flex items-center gap-1'>
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
              />
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
              />
            </svg>
            <span>{location}</span>
          </div>
        )}
      </div>

      {nextMatch && (
        <div className='mt-3 pt-3 border-t border-gray-100'>
          <p className='text-sm text-gray-600'>
            Próximo partido: <span className='font-medium'>{nextMatch}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default GroupCard;
