import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Test basic connectivity
    const testQuery = await prisma.$queryRaw`SELECT 1 as test`;

    // Get database connection information
    const connectionInfo =
      await prisma.$queryRaw`SELECT current_database(), version()`;

    return res.status(200).json({
      success: true,
      env: process.env.NODE_ENV,
      testQuery,
      connectionInfo,
      message: 'Database connection successful',
    });
  } catch (error: any) {
    console.error('Database connection failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      message: 'Database connection failed',
    });
  }
}
