import { createTestRequest } from '../setup';
import handler from '@/pages/api/users/login';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('Login API', () => {
  const mockUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    image: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the JWT secret
    process.env.JWT_SECRET = 'test-secret-key';
  });

  it('should return 400 if email or password is missing', async () => {
    const { req, res } = createTestRequest('POST', {
      email: 'test@example.com',
      // Missing password
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ message: 'Missing required fields' });
  });

  it('should return 401 if user is not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const { req, res } = createTestRequest('POST', {
      email: 'nonexistent@example.com',
      password: 'password123',
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Invalid credentials' });
  });

  it('should return 401 if password is incorrect', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const { req, res } = createTestRequest('POST', {
      email: 'test@example.com',
      password: 'wrong-password',
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Invalid credentials' });
  });

  it('should return user and token if credentials are correct', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const { req, res } = createTestRequest('POST', {
      email: 'test@example.com',
      password: 'password123',
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = res._getJSONData();
    expect(responseData).toHaveProperty('user');
    expect(responseData).toHaveProperty('token');
    expect(responseData.user).toMatchObject({
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
    });
  });
});
