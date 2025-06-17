import { useRouter } from 'next/router';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header
      className='!bg-primary-500 shadow-green-lg backdrop-blur-md border-b border-primary-300 relative z-[50]'
      style={{ backgroundColor: '#10b981' }}
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center'>
            <div className='flex-shrink-0 flex items-center'>
              <div className='flex items-center space-x-2 group'>
                <div className='w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 border border-white/30'>
                  <span className='text-white text-lg font-bold'>⚽</span>
                </div>
                <span className='text-2xl font-bold text-white drop-shadow-sm'>
                  Paloparti
                </span>
              </div>
            </div>
          </div>

          <div className='flex items-center'>
            <Button
              onClick={handleLogout}
              variant='outline'
              size='sm'
              className='bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50 shadow-sm hover:shadow-lg transition-all duration-200 backdrop-blur-sm'
            >
              <svg
                className='w-4 h-4 mr-2'
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
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
