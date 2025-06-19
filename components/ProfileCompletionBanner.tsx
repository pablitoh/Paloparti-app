import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  checkProfileCompletion,
  ProfileCompletionStatus,
} from '../lib/userProfileUtils';

export default function ProfileCompletionBanner() {
  const { data: session, status } = useSession();
  const [profileStatus, setProfileStatus] =
    useState<ProfileCompletionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (session?.user) {
      const user = session.user as any; // Casting para acceder a birthdate
      const status = checkProfileCompletion({
        id: user.id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        image: user.image,
        password: null,
        emailVerified: null,
      });
      setProfileStatus(status);
    }
  }, [session]);

  // No mostrar si está cargando, perfil completo, o fue desestimado
  if (
    status === 'loading' ||
    !profileStatus ||
    profileStatus.isComplete ||
    dismissed
  ) {
    return null;
  }

  const getMissingFieldsText = () => {
    const fields = profileStatus.missingFields;
    if (fields.includes('name') && fields.includes('birthdate')) {
      return 'tu nombre y fecha de nacimiento';
    } else if (fields.includes('name')) {
      return 'tu nombre';
    } else if (fields.includes('birthdate')) {
      return 'tu fecha de nacimiento';
    }
    return 'tu perfil';
  };

  return (
    <div className='bg-orange-50 border-l-4 border-orange-400 p-4 mb-6'>
      <div className='flex items-center justify-between'>
        <div className='flex'>
          <div className='flex-shrink-0'>
            <svg
              className='h-5 w-5 text-orange-400'
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              <path
                fillRule='evenodd'
                d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <div className='ml-3'>
            <p className='text-sm text-orange-700'>
              <strong>Completa tu perfil:</strong> Necesitamos que agregues{' '}
              {getMissingFieldsText()} para usar todas las funciones de la
              aplicación.
            </p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          <Link href='/profile/edit'>
            <button className='bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-1 px-3 rounded transition-colors duration-200'>
              Completar ahora
            </button>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className='text-orange-400 hover:text-orange-600 p-1'
            title='Descartar'
          >
            <svg
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
