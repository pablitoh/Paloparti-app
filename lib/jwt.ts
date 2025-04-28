import jwt from 'jsonwebtoken';

console.log('JWT_SECRET is set?', !!process.env.JWT_SECRET);

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set');
  throw new Error('JWT_SECRET environment variable is not set');
}

const JWT_SECRET = process.env.JWT_SECRET;
console.log('JWT_SECRET loaded successfully');

export const signToken = (payload: any) => {
  console.log('signToken called with payload:', payload);
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in signToken');
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    // Ensure the payload has consistent field names
    const tokenPayload = {
      ...payload,
      // If 'userId' is not provided, but 'sub' is, use 'sub' for 'userId'
      userId: payload.userId || payload.sub,
      // If 'sub' is not provided, but 'userId' is, use 'userId' for 'sub'
      sub: payload.sub || payload.userId,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });
    console.log('Token signed successfully with payload:', tokenPayload);
    return token;
  } catch (error) {
    console.error('Error signing token:', error);
    throw error;
  }
};

export const verifyToken = (token: string) => {
  console.log('verifyToken called');
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in verifyToken');
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: string;
      sub?: string;
    };
    console.log('Token verified successfully:', decoded);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid token');
  }
};
