import { createTestRequest } from '../setup';
import groupsHandler from '@/pages/api/groups';
import loginHandler from '@/pages/api/users/login';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    group: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('Groups API with Authentication', () => {
  const mockUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    image: null,
  };

  const mockGroups = [
    {
      id: 'group-1',
      name: 'Test Group',
      description: 'Test Description',
      sport: 'Football',
      location: 'Test Location',
      createdAt: new Date(),
      createdBy: mockUser.id,
      nextMatch: null,
      totalMatches: 0,
      members: [
        {
          user: {
            id: mockUser.id,
            name: mockUser.name,
            image: mockUser.image,
          },
          role: 'ADMIN',
        },
      ],
      matches: [],
    },
  ];

  let authToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the JWT secret
    process.env.JWT_SECRET = 'test-secret-key';
  });

  describe('Login and Get Groups Flow', () => {
    it('should login and then fetch groups with the received token', async () => {
      // Mock login response
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // First, perform login
      const loginReq = createTestRequest('POST', {
        email: 'test@example.com',
        password: 'password123',
      });
      await loginHandler(loginReq.req, loginReq.res);

      expect(loginReq.res._getStatusCode()).toBe(200);
      const loginResponse = loginReq.res._getJSONData();
      expect(loginResponse).toHaveProperty('token');
      authToken = loginResponse.token;

      // Mock groups response
      (prisma.group.findMany as jest.Mock).mockResolvedValue(mockGroups);

      // Then, fetch groups using the token
      const groupsReq = createTestRequest('GET', undefined, {
        Authorization: `Bearer ${authToken}`,
      });
      await groupsHandler(groupsReq.req, groupsReq.res);

      expect(groupsReq.res._getStatusCode()).toBe(200);
      const groupsResponse = groupsReq.res._getJSONData();
      expect(groupsResponse).toHaveLength(1);
      expect(groupsResponse[0]).toMatchObject({
        id: 'group-1',
        name: 'Test Group',
        description: 'Test Description',
        sport: 'Football',
        location: 'Test Location',
      });
    });

    it('should fail to fetch groups with an invalid token', async () => {
      // Mock groups response
      (prisma.group.findMany as jest.Mock).mockResolvedValue(mockGroups);

      // Try to fetch groups with an invalid token
      const groupsReq = createTestRequest('GET', undefined, {
        Authorization: 'Bearer invalid-token',
      });
      await groupsHandler(groupsReq.req, groupsReq.res);

      expect(groupsReq.res._getStatusCode()).toBe(401);
      expect(groupsReq.res._getJSONData()).toEqual({
        message: 'Invalid token',
      });
    });
  });
});
