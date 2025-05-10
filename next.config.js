/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
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
  transpilePackages: ['rc-util', '@rc-component/util', 'antd'],
};

module.exports = nextConfig;
