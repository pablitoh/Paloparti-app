import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  // If user is already authenticated, redirect to groups page
  if (session) {
    return {
      redirect: {
        destination: '/groups',
        permanent: false,
      },
    };
  }

  // Otherwise redirect to signin page
  return {
    redirect: {
      destination: '/auth/signin',
      permanent: false,
    },
  };
};

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/signin');
  }, [router]);

  // This will show very briefly during redirect
  return (
    <div className='flex justify-center items-center min-h-screen'>
      <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
    </div>
  );
}
