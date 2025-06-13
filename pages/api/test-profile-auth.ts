import { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '../../lib/auth';

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
    console.log(
      'Testing profile authentication exactly like the profile API...'
    );

    // Enhanced logging for preview environment
    if (process.env.VERCEL_ENV === 'preview') {
      console.log('Profile auth test called in preview:', {
        cookie: req.headers.cookie ? 'Present' : 'Missing',
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        sessionCookie: req.headers.cookie?.includes('next-auth.session-token')
          ? 'Present'
          : 'Missing',
        userAgent: req.headers['user-agent']?.substring(0, 50),
        host: req.headers.host,
      });
    }

    // Get the current user from the NextAuth session (exactly like profile API)
    const user = await getCurrentUser(req, res);

    if (!user) {
      console.log('No authenticated user found in profile auth test');
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('Preview environment - detailed auth failure debug');
      }
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - same as profile API would return',
        debug: {
          timestamp: new Date().toISOString(),
          userFound: false,
          cookies: {
            sessionToken: req.cookies['next-auth.session-token']
              ? 'Present'
              : 'Missing',
            csrfToken: req.cookies['next-auth.csrf-token']
              ? 'Present'
              : 'Missing',
          },
        },
      });
    }

    console.log('Processing profile auth test for user:', user.id);
    if (process.env.VERCEL_ENV === 'preview') {
      console.log(
        'Preview environment - user authenticated successfully:',
        user.email
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Authentication successful - profile API would work',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      debug: {
        timestamp: new Date().toISOString(),
        userFound: true,
        cookies: {
          sessionToken: req.cookies['next-auth.session-token']
            ? 'Present'
            : 'Missing',
          csrfToken: req.cookies['next-auth.csrf-token']
            ? 'Present'
            : 'Missing',
        },
      },
    });
  } catch (error) {
    console.error('Profile auth test error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
