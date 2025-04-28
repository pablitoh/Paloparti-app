import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hash a known password
  const hashedPassword = await bcrypt.hash('test123', 10);

  try {
    // Create or update the test user
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
      },
    });

    console.log('Test user created successfully:');
    console.log({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
