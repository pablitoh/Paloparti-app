import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../lib/jwt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers for all requests
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

  // Handle OPTIONS request - critically important for preflight in production
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure only POST method is allowed
  if (req.method !== 'POST') {
    console.error(`Method ${req.method} not allowed at /api/auth/register`);
    return res.status(405).json({
      message: `Method ${req.method} not allowed`,
    });
  }

  try {
    const { name, email, password, birthdate } = req.body;

    // Log request info in development (not in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Register request body:', {
        name,
        email,
        hasPassword: !!password,
        hasBirthdate: !!birthdate,
      });
    }

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({
          message:
            'El correo electrónico ya está registrado. Por favor, utiliza otro o inicia sesión.',
        });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with birthdate if provided
    const userData = {
      name,
      email,
      password: hashedPassword,
    };

    // Add birthdate if provided (handle as optional)
    if (birthdate) {
      try {
        const birthdateValue = new Date(birthdate);
        Object.assign(userData, { birthdate: birthdateValue });
      } catch (err) {
        console.error('Error parsing birthdate:', err);
        // Continue without birthdate if there's a parsing error
      }
    }

    const user = await prisma.user.create({
      data: userData,
    });

    // Generate token using the signToken function
    const token = signToken({ userId: user.id });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
