import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NextRouter } from 'next/router';
import { PencilIcon, ShareIcon } from '@heroicons/react/24/outline';
import { showSuccessToast } from '../../services/toastService';

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
}) => {
  const [isSticky, setIsSticky] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(entry.intersectionRatio < 1);
      },
      {
        threshold: [1],
        rootMargin: '-64px 0px 0px 0px', // Offset for the main header height
      }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={headerRef}
      className={`sticky top-16 z-[9997] bg-primary-500 mb-0 left-0 right-0 w-full transition-all duration-200 ${
        isSticky
          ? 'rounded-none border-0 shadow-lg'
          : 'rounded-2xl border border-primary-300 shadow-green-lg'
      }`}
      style={{
        backgroundColor: '#10b981 !important',
        marginTop: isSticky ? '-1px' : '0', // Para eliminar el espacio entre headers cuando sea sticky
      }}
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4'>
        <div className='flex items-center justify-between gap-2 sm:gap-3 flex-nowrap'>
          {/* Información del grupo - lado izquierdo */}
          <div className='flex items-center gap-1 sm:gap-2 min-w-0 flex-1'>
            <h1 className='text-base sm:text-xl font-bold text-white truncate flex-shrink min-w-0'>
              {group.name}
            </h1>
            {recurrenceText && (
              <span className='hidden md:inline text-xs sm:text-sm text-white/90 bg-white/20 px-2 py-1 rounded-lg flex-shrink-0'>
                {recurrenceText}
              </span>
            )}
            {currentUserIsAdmin && (
              <span className='hidden sm:inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white shadow-sm flex-shrink-0'>
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

          {/* Botones - lado derecho */}
          <div className='flex items-center space-x-1 sm:space-x-2 flex-shrink-0'>
            {/* User status (pendiente) - solo en desktop */}
            {group.userStatus === 'PENDING' && (
              <span className='hidden lg:inline-flex px-2 py-1 bg-warning-100 text-warning-800 rounded-full text-xs font-medium border border-warning-200 flex-shrink-0'>
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
                    d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                Pendiente
              </span>
            )}

            {/* Invite button - compacto en mobile */}
            <button
              onClick={copyInviteLink}
              disabled={isCopying}
              className='flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg sm:rounded-xl hover:bg-white/30 transition-all duration-200 disabled:opacity-50 flex-shrink-0'
              title='Compartir enlace de invitación'
            >
              {isCopying ? (
                <div className='animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent'></div>
              ) : (
                <ShareIcon className='h-3 w-3 sm:h-4 sm:w-4' />
              )}
              <span className='text-xs sm:text-sm font-medium hidden sm:inline'>
                {isCopying ? 'Copiando...' : 'Compartir'}
              </span>
            </button>

            {/* Edit button - solo para admins */}
            {currentUserIsAdmin && (
              <button
                onClick={() => router.push(`/edit-group/${group.id}`)}
                className='p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg sm:rounded-xl transition-all duration-200 flex-shrink-0'
                title='Editar grupo'
              >
                <PencilIcon className='h-4 w-4 sm:h-5 sm:w-5' />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupHeader;
