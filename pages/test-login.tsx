import { useState } from 'react';
import Link from 'next/link';

export default function TestLogin() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('test123');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTestAuth = async () => {
    try {
      setLoading(true);
      setError('');
      setResult('');

      const response = await fetch('/api/test-auth');
      const data = await response.json();

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Test auth error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setResult('');

      console.log('Attempting login with:', { email, password });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('Login response:', { status: response.status, data });

      setResult(
        JSON.stringify(
          {
            status: response.status,
            data,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Test Authentication</h1>

      <div className='mb-4 p-4 bg-yellow-100 text-yellow-800 rounded'>
        <p>
          This is a test page. Please use the{' '}
          <Link href='/auth/signin' className='underline font-bold'>
            official login page
          </Link>{' '}
          to sign in.
        </p>
      </div>

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-4'>Test Auth Endpoint</h2>
        <button
          onClick={handleTestAuth}
          disabled={loading}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400'
        >
          Test Auth
        </button>
      </div>

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-4'>Test Login</h2>
        <div className='space-y-4'>
          <div>
            <label className='block mb-1'>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='w-full p-2 border rounded'
            />
          </div>
          <div>
            <label className='block mb-1'>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full p-2 border rounded'
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400'
          >
            Login
          </button>
        </div>
      </div>

      {error && (
        <div className='p-4 bg-red-100 text-red-800 rounded mb-4'>
          <p className='font-semibold'>Error:</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className='p-4 bg-gray-100 rounded'>
          <p className='font-semibold mb-2'>Result:</p>
          <pre className='whitespace-pre-wrap overflow-auto'>{result}</pre>
        </div>
      )}
    </div>
  );
}
