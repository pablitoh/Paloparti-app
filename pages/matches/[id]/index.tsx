import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';

// Esta página redirige a /matches/[id]/results
export default function MatchRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      router.replace(`/matches/${id}/results`);
    }
  }, [id, router]);

  return (
    <div className='flex items-center justify-center min-h-screen'>
      <p className='text-gray-500'>Redireccionando...</p>
    </div>
  );
}

// También manejamos la redirección del lado del servidor para SEO
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.query;

  if (id) {
    return {
      redirect: {
        destination: `/matches/${id}/results`,
        permanent: false,
      },
    };
  }

  return { props: {} };
};
