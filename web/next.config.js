/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for server actions
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // Transpile the parent src directory
  transpilePackages: [],
  // Allow importing from parent directory
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

module.exports = nextConfig;
