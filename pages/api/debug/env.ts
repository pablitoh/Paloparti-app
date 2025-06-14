import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only show env vars in development or if a specific debug key is provided
  const debugKey = req.query.debug;

  if (
    process.env.NODE_ENV === 'production' &&
    debugKey !== 'paloparti-debug-2024'
  ) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const supabaseVars = Object.keys(process.env)
    .filter((key) => key.includes('SUPABASE'))
    .reduce((acc, key) => {
      // Only show the first few characters for security
      const value = process.env[key];
      acc[key] = value ? `${value.substring(0, 20)}...` : undefined;
      return acc;
    }, {} as Record<string, string | undefined>);

  const allEnvVars = Object.keys(process.env)
    .filter(
      (key) =>
        key.includes('SUPABASE') ||
        key.includes('PALOPARTI') ||
        key.includes('VERCEL') ||
        key.includes('NEXT_PUBLIC')
    )
    .sort();

  return res.json({
    message: 'Debug information for Supabase configuration',
    supabaseVars,
    allRelevantEnvVars: allEnvVars,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
