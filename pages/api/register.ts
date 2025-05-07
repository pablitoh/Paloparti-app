import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Este endpoint está deprecado y redirige a /api/auth/register
 * Mantenido por compatibilidad con versiones anteriores
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure only POST method is allowed
  if (req.method !== 'POST') {
    console.error(`Method ${req.method} not allowed at /api/register`);
    return res.status(405).json({
      message: `Method ${req.method} not allowed`,
    });
  }

  try {
    console.log(
      'Redirecting registration request from /api/register to /api/auth/register'
    );

    // Forward the request to the new endpoint
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || ''}/api/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error in /api/register redirect:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
