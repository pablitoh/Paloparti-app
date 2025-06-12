import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getToken } from 'next-auth/jwt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check environment variables
    const envCheck = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      VERCEL_URL: process.env.VERCEL_URL ? 'SET' : 'NOT SET',
    };

    // Check session
    const session = await getServerSession(req, res, authOptions);

    // Check JWT token
    const token = await getToken({ req });

    // Check cookies
    const cookies = req.headers.cookie || 'No cookies';
    const sessionTokenCookie =
      req.cookies['next-auth.session-token'] || 'Not found';
    const csrfTokenCookie = req.cookies['next-auth.csrf-token'] || 'Not found';

    // Check headers
    const relevantHeaders = {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
    };

    return res.status(200).json({
      success: true,
      environment: envCheck,
      session: session
        ? {
            user: session.user?.email,
            expires: session.expires,
          }
        : null,
      token: token
        ? {
            sub: token.sub,
            email: token.email,
            iat: token.iat,
            exp: token.exp,
          }
        : null,
      cookies: {
        sessionToken: sessionTokenCookie,
        csrfToken: csrfTokenCookie,
        allCookies:
          cookies.length > 200 ? cookies.substring(0, 200) + '...' : cookies,
      },
      headers: relevantHeaders,
      requestUrl: req.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug auth error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack:
        process.env.NODE_ENV === 'development'
          ? (error as Error).stack
          : undefined,
    });
  }
}
