import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
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

  // Generate avatar URL based on user name
  const getAvatarUrl = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      <nav className='bg-white shadow-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex'>
              <div className='flex-shrink-0 flex items-center'>
                <Link
                  href={session?.user ? '/groups' : '/'}
                  className='text-xl font-bold text-blue-600'
                >
                  Paloparti
                </Link>
              </div>
            </div>

            {/* Mobile menu - visible on small screens only */}
            <div className='sm:hidden flex items-center'>
              {session?.user ? (
                <div className='relative' ref={mobileDropdownRef}>
                  <button
                    className='flex items-center space-x-1 focus:outline-none'
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <img
                      src={
                        session.user.image ||
                        getAvatarUrl(session.user.name || '')
                      }
                      alt={session.user.name || ''}
                      className='h-8 w-8 rounded-full'
                    />
                    <svg
                      className='w-4 h-4 text-gray-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d={mobileMenuOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                      />
                    </svg>
                  </button>

                  {mobileMenuOpen && (
                    <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10'>
                      <div className='px-4 py-2 text-sm font-medium text-gray-800 border-b border-gray-100'>
                        {session.user.name}
                      </div>
                      <Link
                        href='/profile'
                        className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Perfil
                      </Link>
                      <button
                        onClick={() => {
                          signOut();
                          setMobileMenuOpen(false);
                        }}
                        className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href='/auth/signin'
                  className='bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700'
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
                    className='flex items-center space-x-2 focus:outline-none'
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <img
                      src={
                        session.user.image ||
                        getAvatarUrl(session.user.name || '')
                      }
                      alt={session.user.name || ''}
                      className='h-8 w-8 rounded-full'
                    />
                    <span className='text-gray-700'>{session.user.name}</span>
                    <svg
                      className='w-4 h-4 text-gray-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d={dropdownOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                      />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10'>
                      <Link
                        href='/profile'
                        className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                        onClick={() => setDropdownOpen(false)}
                      >
                        Perfil
                      </Link>
                      <button
                        onClick={() => {
                          signOut();
                          setDropdownOpen(false);
                        }}
                        className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href='/auth/signin'
                  className='bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700'
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
