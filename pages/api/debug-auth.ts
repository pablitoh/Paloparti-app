import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getCurrentUser } from '../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get both authentication methods
    const session = await getServerSession(req, res, authOptions);
    const user = await getCurrentUser(req);

    return res.status(200).json({
      message: 'Authentication debug information',
      nextAuthSession: {
        exists: !!session,
        user: session?.user || null,
      },
      getCurrentUser: {
        exists: !!user,
        user: user || null,
      },
      headers: {
        cookie: req.headers.cookie ? 'Present' : 'Missing',
        authorization: req.headers.authorization ? 'Present' : 'Missing',
      },
    });
  } catch (error) {
    console.error('Error in debug-auth endpoint:', error);
    return res.status(500).json({
      error: 'Failed to debug authentication',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
