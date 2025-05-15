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
    <div className='sticky top-0 z-[2] bg-white rounded-xl shadow-sm p-4 mb-0'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          {/* Icono de hamburguesa para el drawer */}
          <button
            onClick={onToggleDrawer}
            className='flex-shrink-0 flex items-center justify-center p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all'
          >
            <Bars3Icon className='h-5 w-5' />
          </button>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='text-xl font-bold text-gray-800 truncate'>
                {group.name}
              </h1>
              {recurrenceText && (
                <span className='hidden sm:inline text-sm text-gray-500'>
                  ({recurrenceText})
                </span>
              )}
            </div>
          </div>
          {currentUserIsAdmin && (
            <span className='hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
              Admin
            </span>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          {/* Invite link button - visible on all devices */}
          <button
            onClick={copyInviteLink}
            className='flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors'
            title='Copiar enlace de invitación'
          >
            <ClipboardIcon className='h-4 w-4' />
            <span className='text-sm'>Invitar</span>
          </button>

          {/* User status (pendiente) */}
          {group.userStatus === 'PENDING' && (
            <span className='hidden sm:inline-flex px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm'>
              Solicitud pendiente
            </span>
          )}

          {/* Admin actions - only edit button */}
          {currentUserIsAdmin && (
            <button
              onClick={() => router.push(`/edit-group/${group.id}`)}
              className='p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all'
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
