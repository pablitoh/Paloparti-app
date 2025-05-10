import React from 'react';
import Link from 'next/link';
import { NextRouter } from 'next/router';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

interface SimpleHeaderProps {
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

const SimpleHeader: React.FC<SimpleHeaderProps> = ({
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
    <div className='sticky top-0 z-10 bg-white rounded-xl shadow-sm p-4 mb-0'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => router.push('/groups')}
            className='flex-shrink-0 flex items-center justify-center p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all'
          >
            <ArrowLeftIcon className='h-5 w-5' />
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
          {/* Mobile menu button - visible only on mobile */}
          <button
            onClick={onToggleDrawer}
            className='md:hidden flex items-center justify-center p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all'
          >
            <Bars3Icon className='h-6 w-6' />
          </button>

          {/* Invite link button - hidden on small mobile */}
          <button
            onClick={copyInviteLink}
            className='hidden sm:flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors'
            title='Copiar enlace de invitación'
          >
            <ClipboardIcon className='h-4 w-4' />
            <span className='text-sm'>Invitar</span>
          </button>

          {/* User status or group actions - hidden on small mobile */}
          {group.userStatus === 'PENDING' ? (
            <span className='hidden sm:inline-flex px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm'>
              Solicitud pendiente
            </span>
          ) : (
            isUserInGroup && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Estás seguro de que quieres salir de este grupo?'
                    )
                  ) {
                    handleLeaveGroup();
                  }
                }}
                className='hidden sm:inline-flex px-3 py-1.5 text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg transition-all duration-200'
              >
                Salir del grupo
              </button>
            )
          )}

          {/* Admin actions - only edit button visible on all screens */}
          {currentUserIsAdmin && (
            <>
              <button
                onClick={() => router.push(`/edit-group/${group.id}`)}
                className='p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all'
                title='Editar grupo'
              >
                <PencilIcon className='h-5 w-5' />
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Estás seguro de que quieres eliminar este grupo? Esta acción no se puede deshacer.'
                    )
                  ) {
                    handleLeaveGroup();
                  }
                }}
                className='hidden sm:flex p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all'
                title='Eliminar grupo'
              >
                <TrashIcon className='h-5 w-5' />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleHeader;
