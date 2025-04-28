import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RedirectToSignIn() {
  const router = useRouter();
  const { redirect } = router.query;

  useEffect(() => {
    if (router.isReady) {
      if (redirect) {
        router.replace(
          `/auth/signin?callbackUrl=${encodeURIComponent(redirect as string)}`
        );
      } else {
        router.replace('/auth/signin');
      }
    }
  }, [router, redirect]);

  return (
    <div className='flex justify-center items-center min-h-screen'>
      <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500'></div>
    </div>
  );
}
