import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';

// Configure test environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'file:./test.db';

// Set test environment
(process.env as any).NODE_ENV = 'test';

export function createTestRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  body?: any,
  headers?: Record<string, string>
) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  return { req, res };
}
