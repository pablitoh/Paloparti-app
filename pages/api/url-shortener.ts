import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import crypto from 'crypto';

interface ShortUrlResponse {
  shortUrl: string;
  error?: string;
}

// This API endpoint does not require authentication
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ShortUrlResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      shortUrl: '',
      error: 'Method not allowed',
    });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        shortUrl: '',
        error: 'URL is required',
      });
    }

    // Generate a short code for the URL
    const shortCode = crypto.randomBytes(4).toString('hex');

    // Store the mapping in the database using raw SQL to avoid type issues
    await prisma.$executeRaw`
      INSERT INTO "ShortUrl" 
      ("id", "shortCode", "originalUrl", "createdAt", "accessCount") 
      VALUES 
      (${crypto
        .randomBytes(16)
        .toString('hex')}, ${shortCode}, ${url}, ${new Date()}, 0)
    `;

    // Create the short URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shortUrl = `${baseUrl}/s/${shortCode}`;

    return res.status(200).json({ shortUrl });
  } catch (error) {
    console.error('Error creating short URL:', error);
    return res.status(500).json({
      shortUrl: '',
      error: 'Error creating short URL',
    });
  }
}
