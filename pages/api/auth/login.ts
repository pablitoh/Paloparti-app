import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return a message indicating this endpoint is deprecated
  return res.status(410).json({
    message:
      'This endpoint is deprecated. Please use the NextAuth.js credentials provider at /api/auth/callback/credentials',
    redirectTo: '/api/auth/signin',
  });
}
