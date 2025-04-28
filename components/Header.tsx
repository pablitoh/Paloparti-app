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
      router.push('/auth/signin');
    }
  };

  return (
    <header className='bg-white shadow-sm'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center'>
            <div className='flex-shrink-0 flex items-center'>
              <span className='text-2xl font-bold text-blue-600'>
                ⚽ Paloparti
              </span>
            </div>
          </div>

          <div className='flex items-center'>
            <Button onClick={handleLogout} variant='outline' size='sm'>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
