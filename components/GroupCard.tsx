import React from 'react';
import { useRouter } from 'next/router';

interface GroupCardProps {
  id: string;
  name: string;
  sport: string;
  membersCount: number;
  nextMatch?: string;
}

const GroupCard: React.FC<GroupCardProps> = ({
  id,
  name,
  sport,
  membersCount,
  nextMatch,
}) => {
  const router = useRouter();

  return (
    <div
      className='bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer'
      onClick={() => router.push(`/group/${id}`)}
    >
      <div className='flex justify-between items-start'>
        <div>
          <h3 className='text-lg font-semibold text-gray-800'>{name}</h3>
          <p className='text-sm text-gray-500'>{sport}</p>
        </div>
        <span className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full'>
          {membersCount} miembros
        </span>
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
