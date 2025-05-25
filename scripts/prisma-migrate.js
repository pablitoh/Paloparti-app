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

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL not found. Skipping migrations.');
  process.exit(0);
}

try {
  console.log(
    `Running Prisma operations in ${process.env.VERCEL_ENV} environment...`
  );

  // Always generate Prisma client first
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client generated successfully');

  // For preview environments, try to connect but don't fail if it doesn't work
  if (isPreview) {
    console.log('Preview environment detected.');
    try {
      console.log('Attempting to check database connection...');
      execSync('npx prisma db pull --print', { stdio: 'pipe' });
      console.log('Database connection successful. Running migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Migrations completed successfully in preview environment');
    } catch (dbError) {
      console.log(
        'Database not accessible in preview environment, skipping migrations.'
      );
      console.log(
        'This is normal for preview deployments without database access.'
      );
    }
    process.exit(0);
  }

  // Run migrations only in production
  if (isProd) {
    console.log(
      'Production environment detected. Running database migrations...'
    );
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Prisma migrations completed successfully');
  }
} catch (error) {
  console.error('Error running Prisma operations:', error);

  // In preview environments, don't fail the build if migrations fail
  if (isPreview) {
    console.log('Error in preview environment, but continuing build...');
    process.exit(0);
  }

  // In production, fail the build if migrations fail
  process.exit(1);
}
