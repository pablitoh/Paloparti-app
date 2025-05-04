/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  // Asegurar que la producción funcione correctamente
  output: 'standalone',
  transpilePackages: ['@rc-component/util', 'rc-util'],
};

module.exports = nextConfig;
