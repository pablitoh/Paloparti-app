import React from 'react';
import Link from 'next/link';
import { NextRouter } from 'next/router';
import {
  PencilIcon,
  ClipboardIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

interface GroupHeaderProps {
  group: any;
  currentUserIsAdmin: boolean;
  isUserInGroup: boolean | undefined;
  handleLeaveGroup: () => Promise<void>;
  recurrenceText: string;
  shortInviteUrl: string | null;
  inviteUrl: string | null;
  copyInviteLink: () => void;
  isCopying: boolean;
  router: NextRouter;
  onToggleDrawer?: () => void;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
  group,
  currentUserIsAdmin,
  isUserInGroup,
  handleLeaveGroup,
  recurrenceText,
  shortInviteUrl,
  inviteUrl,
  copyInviteLink,
  isCopying,
  router,
  onToggleDrawer,
}) => {
  return (
    <div className='sticky top-0 z-[2] bg-white rounded-2xl shadow-green-lg p-4 mb-0 border border-primary-100'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          {/* Icono de hamburguesa para el drawer */}
          <button
            onClick={onToggleDrawer}
            className='flex-shrink-0 flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200'
          >
            <Bars3Icon className='h-5 w-5' />
          </button>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='text-xl font-bold text-gray-800 truncate'>
                {group.name}
              </h1>
              {recurrenceText && (
                <span className='hidden sm:inline text-sm text-primary-600 bg-primary-50 px-2 py-1 rounded-lg'>
                  {recurrenceText}
                </span>
              )}
            </div>
          </div>
          {currentUserIsAdmin && (
            <span className='hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-green text-white shadow-green'>
              <svg
                className='w-3 h-3 mr-1'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
                />
              </svg>
              Admin
            </span>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          {/* Invite link button - visible on all devices */}
          <button
            onClick={copyInviteLink}
            disabled={isCopying}
            className='flex items-center space-x-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 hover:shadow-green transition-all duration-200 disabled:opacity-50'
            title='Copiar enlace de invitación'
          >
            {isCopying ? (
              <div className='animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent'></div>
            ) : (
              <ClipboardIcon className='h-4 w-4' />
            )}
            <span className='text-sm font-medium'>
              {isCopying ? 'Copiando...' : 'Invitar'}
            </span>
          </button>

          {/* User status (pendiente) */}
          {group.userStatus === 'PENDING' && (
            <span className='hidden sm:inline-flex px-3 py-1 bg-warning-100 text-warning-800 rounded-full text-sm font-medium border border-warning-200'>
              <svg
                className='w-4 h-4 mr-1'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              Pendiente
            </span>
          )}

          {/* Admin actions - only edit button */}
          {currentUserIsAdmin && (
            <button
              onClick={() => router.push(`/edit-group/${group.id}`)}
              className='p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 hover:shadow-sm'
              title='Editar grupo'
            >
              <PencilIcon className='h-5 w-5' />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupHeader;
