import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const { logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <div className='min-h-screen bg-gradient-green-soft'>
      <nav className='bg-white shadow-green-lg backdrop-blur-md border-b border-primary-100 relative z-[9998]'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex'>
              <div className='flex-shrink-0 flex items-center'>
                <Link
                  href={session?.user ? '/groups' : '/'}
                  className='flex items-center space-x-2 group'
                >
                  <div className='w-8 h-8 bg-gradient-green rounded-full flex items-center justify-center transition-transform group-hover:scale-110'>
                    <span className='text-white text-lg font-bold'>⚽</span>
                  </div>
                  <span className='text-xl font-bold bg-gradient-green bg-clip-text text-transparent'>
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
                    className='flex items-center space-x-1 focus:outline-none p-2 rounded-xl hover:bg-primary-50 transition-colors'
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <Avatar
                      src={session.user.image}
                      alt={session.user.name || ''}
                      size='sm'
                      fallbackText={session.user.name || 'U'}
                      className='h-8 w-8 ring-2 ring-primary-200'
                    />
                    <svg
                      className={`w-4 h-4 text-primary-600 transition-transform ${
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
                        onClick={() => {
                          logout();
                          setMobileMenuOpen(false);
                        }}
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
                  className='bg-gradient-green text-white px-4 py-2 rounded-xl text-sm font-medium hover:shadow-green transition-all duration-200 transform active:scale-95'
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
                    className='flex items-center space-x-3 focus:outline-none p-2 rounded-xl hover:bg-primary-50 transition-colors'
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <Avatar
                      src={session.user.image}
                      alt={session.user.name || ''}
                      size='sm'
                      fallbackText={session.user.name || 'U'}
                      className='h-8 w-8 ring-2 ring-primary-200'
                    />
                    <span className='text-gray-700 font-medium'>
                      {session.user.name}
                    </span>
                    <svg
                      className={`w-4 h-4 text-primary-600 transition-transform ${
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
                        onClick={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
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
                  className='bg-gradient-green text-white px-6 py-2 rounded-xl text-sm font-medium hover:shadow-green transition-all duration-200 transform active:scale-95'
                >
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
