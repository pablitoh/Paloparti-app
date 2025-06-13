import { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../lib/auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir este endpoint en preview
  if (process.env.VERCEL_ENV !== 'preview') {
    return res
      .status(404)
      .json({ error: 'Endpoint only available in preview' });
  }

  try {
    console.log('Testing auth functions...');

    // Test 1: getServerSession directly
    const session = await getServerSession(req, res, authOptions);

    // Test 2: getCurrentUser
    const user = await getCurrentUser(req, res);

    const result = {
      timestamp: new Date().toISOString(),
      tests: {
        getServerSession: {
          success: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
        },
        getCurrentUser: {
          success: !!user,
          userId: user?.id,
          userEmail: user?.email,
        },
      },
      cookies: {
        sessionToken: req.cookies['next-auth.session-token']
          ? 'Present'
          : 'Missing',
        csrfToken: req.cookies['next-auth.csrf-token'] ? 'Present' : 'Missing',
      },
      conclusion: {
        sessionWorking: !!session && !!session.user,
        getCurrentUserWorking: !!user,
        bothWorking: !!(session && session.user && user),
      },
    };

    console.log('Auth test results:', JSON.stringify(result, null, 2));

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
