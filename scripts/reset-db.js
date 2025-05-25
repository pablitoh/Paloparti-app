#!/usr/bin/env node

// This script resets and syncs the database for local development
const { execSync } = require('child_process');

console.log('Resetting and syncing database...');

try {
  // Generate Prisma client
  console.log('1. Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Reset database (only for development)
  console.log('2. Resetting database...');
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });

  console.log('Database reset and sync completed successfully!');
} catch (error) {
  console.error('Error resetting database:', error);
  process.exit(1);
}
