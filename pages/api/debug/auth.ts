import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../auth/[...nextauth]';
import { getCurrentUser } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only show debug info in development or preview with specific key
  const debugKey = req.query.debug;

  if (
    process.env.NODE_ENV === 'production' &&
    debugKey !== 'paloparti-debug-2024'
  ) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const token = await getToken({ req });
    const currentUser = await getCurrentUser(req, res);

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        hasNEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      },
      cookies: {
        all: req.headers.cookie ? req.headers.cookie.split(';').length : 0,
        sessionToken: req.headers.cookie?.includes('next-auth.session-token')
          ? 'Present'
          : 'Missing',
        csrfToken: req.headers.cookie?.includes('next-auth.csrf-token')
          ? 'Present'
          : 'Missing',
      },
      session: {
        exists: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
      },
      jwtToken: {
        exists: !!token,
        email: token?.email,
        sub: token?.sub,
        name: token?.name,
      },
      currentUser: {
        exists: !!currentUser,
        id: currentUser?.id,
        email: currentUser?.email,
        name: currentUser?.name,
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        referer: req.headers.referer,
      },
    };

    return res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
