import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '../../lib/jwt';

/**
 * Endpoint principal para el registro de usuarios
 * Este endpoint está en la raíz de /api para evitar problemas con rutas anidadas en Vercel
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log all request details in production for debugging
  console.log(
    `[REGISTER DEBUG] Request received at ${new Date().toISOString()}`
  );
  console.log(`[REGISTER DEBUG] Request method: ${req.method}`);
  console.log(`[REGISTER DEBUG] Request URL: ${req.url}`);

  // Always set CORS headers first thing
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

  // Handle OPTIONS request immediately
  if (req.method === 'OPTIONS') {
    console.log('[REGISTER DEBUG] Handling OPTIONS request - returning 200');
    return res.status(200).end();
  }

  // Ensure only POST method is allowed
  if (req.method !== 'POST') {
    console.error(
      `[REGISTER DEBUG] Method ${req.method} not allowed at /api/register`
    );
    return res.status(405).json({
      message: `Method ${req.method} not allowed`,
    });
  }

  try {
    console.log('[REGISTER DEBUG] Processing POST registration request');

    // Try to get the request body
    let name: string | undefined;
    let email: string | undefined;
    let password: string | undefined;
    let birthdate: string | undefined;

    try {
      const body = req.body;
      name = body.name;
      email = body.email;
      password = body.password;
      birthdate = body.birthdate;
      console.log('[REGISTER DEBUG] Request body parsed');
    } catch (bodyError) {
      console.error('[REGISTER DEBUG] Error parsing request body:', bodyError);
      return res.status(400).json({ message: 'Invalid request body format' });
    }

    // Validate the required fields
    if (!name || !email || !password) {
      console.error('[REGISTER DEBUG] Missing required fields');
      return res.status(400).json({
        message:
          'Missing required fields: name, email and password are required',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('[REGISTER DEBUG] User already exists:', email);
      return res.status(400).json({
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
        console.error('[REGISTER DEBUG] Error parsing birthdate:', err);
        // Continue without birthdate if there's a parsing error
      }
    }

    // Create the user in the database
    const user = await prisma.user.create({
      data: userData,
    });

    console.log('[REGISTER DEBUG] User created successfully:', user.id);

    // Generate token using the signToken function
    const token = signToken({ userId: user.id });

    // Return success response
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[REGISTER DEBUG] Error in /api/register:', error);
    return res
      .status(500)
      .json({ message: 'Internal server error', error: String(error) });
  }
}
