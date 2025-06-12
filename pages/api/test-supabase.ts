import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if environment variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const config = {
      supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
      supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
      supabaseServiceKey: supabaseServiceKey ? 'SET' : 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
    };

    // Test basic Supabase client creation
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        return res.status(200).json({
          success: true,
          message: 'Supabase client created successfully',
          config,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Error creating Supabase client',
          error: error instanceof Error ? error.message : 'Unknown error',
          config,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Supabase environment variables not configured',
        config,
      });
    }
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
