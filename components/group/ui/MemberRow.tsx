import React from 'react';

interface Member {
  id: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'member' | 'captain';
  joinedAt?: Date;
}

interface MemberRowProps {
  member: Member;
  onActionClick?: () => void;
  actionText?: string;
  actionIcon?: React.ReactNode;
  onNameClick?: () => void;
}

export default function MemberRow({
  member,
  onActionClick,
  actionText = 'Ver perfil',
  actionIcon,
  onNameClick,
}: MemberRowProps) {
  const formattedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '';

  return (
    <div className='flex items-center justify-between py-3 border-b border-gray-100 last:border-0'>
      <div className='flex items-center gap-3'>
        <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden'>
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-gray-400 text-xs'>👤</span>
          )}
        </div>
        <div>
          <button
            className='text-sm font-medium text-gray-700 hover:text-gray-900'
            onClick={onNameClick}
          >
            {member.name}
          </button>
          {member.role && (
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                member.role === 'admin'
                  ? 'bg-purple-100 text-purple-800'
                  : member.role === 'captain'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {member.role === 'admin'
                ? 'Admin'
                : member.role === 'captain'
                ? 'Capitán'
                : 'Miembro'}
            </span>
          )}
          {formattedDate && (
            <span className='block text-xs text-gray-500'>
              Se unió el {formattedDate}
            </span>
          )}
        </div>
      </div>
      {onActionClick && (
        <button
          onClick={onActionClick}
          className='text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1'
        >
          {actionIcon}
          {actionText}
        </button>
      )}
    </div>
  );
}
