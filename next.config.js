/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,

  // Configuración específica para Vercel
  env: {
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL ||
      (process.env.NODE_ENV === 'development' && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : undefined),
  },

  // Configuración de headers para CORS
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Asegurarse de que los módulos problemáticos de rc-util se carguen correctamente
    config.resolve.alias = {
      ...config.resolve.alias,
      'rc-util/es/warning': path.resolve(
        __dirname,
        './utils/rc-util-warning.js'
      ),
    };

    return config;
  },

  // Asegurar que la producción funcione correctamente
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['rc-util', '@rc-component/util', 'antd'],
};

module.exports = nextConfig;
