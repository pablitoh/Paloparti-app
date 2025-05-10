#!/usr/bin/env node

// This script runs Prisma migrations in Vercel environments
const { execSync } = require('child_process');

// Determine if we're in a preview deployment
const isPreview = process.env.VERCEL_ENV === 'preview';
const isProd = process.env.VERCEL_ENV === 'production';

if (!isPreview && !isProd) {
  console.log(
    'Not in a Vercel preview or production environment. Skipping migrations.'
  );
  process.exit(0);
}

try {
  console.log(
    `Running Prisma migrations in ${process.env.VERCEL_ENV} environment...`
  );

  // Generate Prisma client
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Run migrations
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Prisma migrations completed successfully');
} catch (error) {
  console.error('Error running Prisma migrations:', error);
  process.exit(1);
}
