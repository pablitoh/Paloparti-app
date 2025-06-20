import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import { useUserGroups } from '../hooks/useUserGroups';
import { useGroupBasicInfo } from '../services/groupHooks';
import {
  Bars3Icon,
  ArrowLeftIcon,
  UsersIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  TrophyIcon,
  DocumentTextIcon,
  InboxIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const Header = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);
  const [drawerAnimating, setDrawerAnimating] = useState(false);

  // Get user groups
  const { userGroups } = useUserGroups();

  // Detect if we're in a group page
  const isInGroupPage = router.pathname.startsWith('/group/');
  const groupId = isInGroupPage ? (router.query.id as string) : null;

  // Get current group info if in group page
  const { data: currentGroup } = useGroupBasicInfo(groupId || undefined, {
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });

  // Define group tabs
  const groupTabs = [
    { label: 'Próximo Partido', icon: CalendarDaysIcon, tabIndex: 0 },
    { label: 'Historial', icon: ClockIcon, tabIndex: 1 },
    { label: 'Goleadores', icon: TrophyIcon, tabIndex: 2 },
    { label: 'MVPs', icon: ChartBarIcon, tabIndex: 3 },
    { label: 'Miembros', icon: UsersIcon, tabIndex: 4 },
    { label: 'Logs', icon: DocumentTextIcon, tabIndex: 5 },
  ];

  // Add requests tab if user is admin
  if (currentGroup?.isAdmin) {
    groupTabs.push({ label: 'Solicitudes', icon: InboxIcon, tabIndex: 6 });
  }

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        mobileDropdownRef.current &&
        !mobileDropdownRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setDropdownOpen(false);
      setMobileMenuOpen(false);
      closeDrawer();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleNavigateToGroup = (groupId: string, tabIndex?: number) => {
    const url =
      tabIndex !== undefined
        ? `/group/${groupId}?tab=${tabIndex}`
        : `/group/${groupId}`;
    router.push(url);
    closeDrawer();
  };

  const openDrawer = () => {
    setNavigationMenuOpen(true);
    // Pequeño delay para asegurar que el DOM se actualice antes de la animación
    setTimeout(() => {
      setDrawerAnimating(true);
    }, 10);
  };

  const closeDrawer = () => {
    setDrawerAnimating(false);
    setTimeout(() => {
      setNavigationMenuOpen(false);
    }, 300); // Esperar a que termine la animación
  };

  return (
    <>
      <header
        className='bg-primary-500 shadow-green-lg backdrop-blur-md relative z-[9998] sticky top-0'
        style={{ backgroundColor: '#10b981 !important' }}
      >
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center h-16'>
            {/* Botón de menú - a la izquierda de todo */}
            {session?.user && (
              <button
                className='flex items-center justify-center w-12 h-12 mr-4 rounded-xl text-white hover:bg-white/10 transition-all duration-200 shadow-sm hover:shadow-md'
                onClick={openDrawer}
              >
                <Bars3Icon className='h-7 w-7' />
              </button>
            )}

            {/* Logo y nombre - centrado */}
            <div className='flex-1 flex items-center'>
              <div className='flex-shrink-0 flex items-center'>
                <Link
                  href={session?.user ? '/groups' : '/'}
                  className='flex items-center space-x-2 group'
                >
                  <div className='w-8 h-8 transition-transform group-hover:scale-110'>
                    <img
                      src='/logo.png'
                      alt='Paloparti Logo'
                      className='w-full h-full object-contain'
                    />
                  </div>
                  <span className='text-2xl font-bold text-white drop-shadow-sm'>
                    Paloparti
                  </span>
                </Link>
              </div>
            </div>

            {/* Mobile menu - visible on small screens only */}
            <div className='sm:hidden flex items-center'>
              {session?.user ? (
                <div className='relative' ref={mobileDropdownRef}>
                  <button
                    className='flex items-center space-x-1 focus:outline-none p-2 rounded-xl hover:bg-white/10 transition-colors'
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <Avatar
                      src={session.user.image}
                      alt={session.user.name || ''}
                      size='sm'
                      fallbackText={session.user.name || 'U'}
                      className='h-8 w-8 ring-2 ring-white/30'
                    />
                    <svg
                      className={`w-4 h-4 text-white transition-transform ${
                        mobileMenuOpen ? 'rotate-180' : ''
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </button>

                  {mobileMenuOpen && (
                    <div className='absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-green-lg border border-primary-100 py-2 z-[9999]'>
                      <div className='px-4 py-3 text-sm font-medium text-gray-800 border-b border-primary-100 bg-primary-50 rounded-t-2xl'>
                        <div className='truncate'>{session.user.name}</div>
                        <div className='text-xs text-primary-600 truncate'>
                          {session.user.email}
                        </div>
                      </div>
                      <Link
                        href='/profile'
                        className='flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors'
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <svg
                          className='w-4 h-4 mr-3 text-primary-500'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                          />
                        </svg>
                        Perfil
                      </Link>
                      <button
                        onClick={handleLogout}
                        className='flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-error-50 hover:text-error-700 transition-colors'
                      >
                        <svg
                          className='w-4 h-4 mr-3 text-error-500'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1'
                          />
                        </svg>
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href='/auth/signin'
                  className='bg-white/10 border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/20 hover:border-white/50 transition-all duration-200 transform active:scale-95'
                >
                  Iniciar sesión
                </Link>
              )}
            </div>

            {/* Desktop menu - hidden on small screens */}
            <div className='hidden sm:ml-6 sm:flex sm:items-center'>
              {session?.user ? (
                <div className='relative' ref={dropdownRef}>
                  <button
                    className='flex items-center space-x-3 focus:outline-none p-2 rounded-xl hover:bg-white/10 transition-colors'
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <Avatar
                      src={session.user.image}
                      alt={session.user.name || ''}
                      size='sm'
                      fallbackText={session.user.name || 'U'}
                      className='h-8 w-8 ring-2 ring-white/30'
                    />
                    <span className='text-white font-medium'>
                      {session.user.name}
                    </span>
                    <svg
                      className={`w-4 h-4 text-white transition-transform ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className='absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-green-lg border border-primary-100 py-2 z-[9999]'>
                      <div className='px-4 py-3 border-b border-primary-100 bg-primary-50 rounded-t-2xl'>
                        <div className='text-sm font-medium text-gray-900 truncate'>
                          {session.user.name}
                        </div>
                        <div className='text-xs text-primary-600 truncate'>
                          {session.user.email}
                        </div>
                      </div>
                      <Link
                        href='/profile'
                        className='flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors'
                        onClick={() => setDropdownOpen(false)}
                      >
                        <svg
                          className='w-4 h-4 mr-3 text-primary-500'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                          />
                        </svg>
                        Ver Perfil
                      </Link>
                      <button
                        onClick={handleLogout}
                        className='flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-error-50 hover:text-error-700 transition-colors rounded-b-2xl'
                      >
                        <svg
                          className='w-4 h-4 mr-3 text-error-500'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1'
                          />
                        </svg>
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href='/auth/signin'
                  className='bg-white/10 border border-white/30 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-white/20 hover:border-white/50 shadow-sm hover:shadow-lg transition-all duration-200 transform active:scale-95'
                >
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Drawer - Deslizante desde la izquierda */}
      {navigationMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black z-[99998] transition-all duration-300 ease-out ${
              drawerAnimating ? 'bg-opacity-50' : 'bg-opacity-0'
            }`}
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <div
            className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-[99999] transition-all duration-300 ease-out overflow-y-auto ${
              drawerAnimating
                ? 'transform translate-x-0'
                : 'transform -translate-x-full'
            }`}
          >
            {/* Header del drawer */}
            <div className='bg-primary-500 px-4 py-4 flex items-center justify-between sticky top-0'>
              <div className='text-white'>
                <div className='text-lg font-bold'>
                  {isInGroupPage
                    ? currentGroup?.name || 'Navegación'
                    : 'Mis Grupos'}
                </div>
                <div className='text-sm text-white/80'>
                  {isInGroupPage
                    ? 'Grupo actual'
                    : `${userGroups.length} ${
                        userGroups.length === 1 ? 'grupo' : 'grupos'
                      }`}
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className='text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            {/* Contenido del drawer */}
            <div
              className={`p-4 transition-all duration-500 delay-150 ${
                drawerAnimating
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4'
              }`}
            >
              {isInGroupPage && currentGroup ? (
                <>
                  {/* Botón volver a grupos */}
                  <button
                    onClick={() => {
                      router.push('/groups');
                      closeDrawer();
                    }}
                    className='flex items-center w-full px-3 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors rounded-lg mb-4'
                  >
                    <ArrowLeftIcon className='w-5 h-5 mr-3 text-primary-500' />
                    <span className='font-medium'>Volver a grupos</span>
                  </button>

                  {/* Tabs del grupo */}
                  <div className='mb-4'>
                    <div className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2'>
                      Secciones del grupo
                    </div>
                    <div className='space-y-1'>
                      {groupTabs.map((tab) => {
                        const IconComponent = tab.icon;
                        return (
                          <button
                            key={tab.tabIndex}
                            onClick={() =>
                              handleNavigateToGroup(
                                currentGroup.id,
                                tab.tabIndex
                              )
                            }
                            className='flex items-center w-full px-3 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors rounded-lg'
                          >
                            <IconComponent className='w-5 h-5 mr-3 text-primary-500' />
                            <span className='text-sm font-medium'>
                              {tab.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Lista de grupos del usuario */}
                  {userGroups.length > 0 ? (
                    <div className='mb-4'>
                      <div className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2'>
                        Mis grupos
                      </div>
                      <div className='space-y-1'>
                        {userGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => handleNavigateToGroup(group.id)}
                            className='flex items-center w-full px-3 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors rounded-lg'
                          >
                            <UsersIcon className='w-5 h-5 mr-3 text-primary-500 flex-shrink-0' />
                            <div className='text-left flex-1 min-w-0'>
                              <div className='font-medium text-sm truncate'>
                                {group.name}
                              </div>
                              <div className='text-xs text-gray-500 truncate'>
                                {group.sport} • {group.location}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className='text-center py-8 mb-4'>
                      <UsersIcon className='w-12 h-12 text-gray-300 mx-auto mb-3' />
                      <div className='text-gray-500 mb-1 text-sm font-medium'>
                        No tienes grupos aún
                      </div>
                      <div className='text-xs text-gray-400'>
                        Crea tu primer grupo para empezar
                      </div>
                    </div>
                  )}

                  {/* Crear nuevo grupo */}
                  <div className='border-t border-gray-200 pt-4'>
                    <button
                      onClick={() => {
                        router.push('/create-group');
                        closeDrawer();
                      }}
                      className='flex items-center w-full px-3 py-3 text-primary-600 hover:bg-primary-50 hover:text-primary-700 transition-colors rounded-lg font-medium'
                    >
                      <svg
                        className='w-5 h-5 mr-3 text-primary-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M12 4v16m8-8H4'
                        />
                      </svg>
                      <span className='text-sm'>Crear nuevo grupo</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Header;
