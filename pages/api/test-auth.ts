import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '../../lib/jwt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Test auth route called');

    // Get or create test user
    const email = 'test@example.com';
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
      },
      create: {
        email,
        name: 'Test User',
        password: hashedPassword,
      },
    });

    console.log('Test user retrieved or created:', {
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Create JWT token
    console.log('Creating JWT token for user:', user.id);
    const token = signToken({ userId: user.id });
    console.log('Token created successfully');

    return res.status(200).json({
      message: 'Test auth successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      loginCredentials: {
        email,
        password, // Only for testing purposes!
      },
    });
  } catch (error) {
    console.error('Test auth error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
