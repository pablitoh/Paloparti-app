import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        message: 'Supabase not configured',
      });
    }

    // Test 1: List buckets
    const { data: buckets, error: bucketsError } =
      await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      return res.status(500).json({
        success: false,
        message: 'Error listing buckets',
        error: bucketsError.message,
      });
    }

    // Check if user-content bucket exists
    const userContentBucket = buckets?.find(
      (bucket) => bucket.name === 'user-content'
    );

    if (!userContentBucket) {
      return res.status(404).json({
        success: false,
        message: 'Bucket "user-content" not found',
        availableBuckets: buckets?.map((b) => b.name) || [],
        instructions:
          'Please create a bucket named "user-content" in your Supabase dashboard under Storage',
      });
    }

    // Test 2: Try to list files in the bucket (should work even if empty)
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('user-content')
      .list('avatars', { limit: 1 });

    return res.status(200).json({
      success: true,
      message: 'Storage configuration is working correctly',
      bucket: {
        name: userContentBucket.name,
        id: userContentBucket.id,
        public: userContentBucket.public,
        created_at: userContentBucket.created_at,
      },
      canListFiles: !filesError,
      filesError: filesError?.message || null,
      testFileCount: files?.length || 0,
    });
  } catch (error) {
    console.error('Storage test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during storage test',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
