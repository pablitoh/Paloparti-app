import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getToken } from 'next-auth/jwt';

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
    // Obtener información del environment
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
      host: req.headers.host,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    };

    // Obtener cookies
    const cookies = {
      sessionToken: req.cookies['next-auth.session-token'] || 'NOT FOUND',
      csrfToken: req.cookies['next-auth.csrf-token'] || 'NOT FOUND',
      callbackUrl: req.cookies['next-auth.callback-url'] || 'NOT FOUND',
      allCookies: Object.keys(req.cookies),
    };

    // Obtener sesión
    const session = await getServerSession(req, res, authOptions);

    // Obtener token JWT
    const token = await getToken({ req });

    // Headers relevantes
    const headers = {
      origin: req.headers.origin,
      referer: req.headers.referer,
      host: req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
    };

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: envInfo,
      cookies,
      headers,
      session: session
        ? {
            user: {
              id: session.user?.id,
              email: session.user?.email,
              name: session.user?.name,
            },
            expires: session.expires,
          }
        : null,
      token: token
        ? {
            sub: token.sub,
            email: token.email,
            id: token.id,
            iat: token.iat,
            exp: token.exp,
            jti: token.jti,
          }
        : null,
      authStatus: {
        hasSession: !!session,
        hasToken: !!token,
        hasSessionToken: !!req.cookies['next-auth.session-token'],
        isAuthenticated: !!(session && session.user),
      },
    };

    // Log para Vercel
    console.log('Preview Auth Debug:', JSON.stringify(debugInfo, null, 2));

    return res.status(200).json({
      success: true,
      debug: debugInfo,
      recommendations: [
        session ? 'Session found ✅' : 'No session found ❌',
        token ? 'Token found ✅' : 'No token found ❌',
        req.cookies['next-auth.session-token']
          ? 'Session cookie found ✅'
          : 'No session cookie found ❌',
        envInfo.NEXTAUTH_SECRET
          ? 'NEXTAUTH_SECRET is set ✅'
          : 'NEXTAUTH_SECRET missing ❌',
        envInfo.VERCEL_URL ? 'VERCEL_URL is set ✅' : 'VERCEL_URL missing ❌',
      ],
    });
  } catch (error) {
    console.error('Preview Auth Debug Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
