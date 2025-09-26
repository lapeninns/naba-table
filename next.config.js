/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // NextJS <Image> component needs to whitelist domains for src={}
      "lh3.googleusercontent.com",
      "pbs.twimg.com",
      "images.unsplash.com",
      "logos-world.net",
    ],
  },
  eslint: {
    dirs: ['app/reserve', 'reserve'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@reserve': path.resolve(__dirname, 'reserve'),
      '@app': path.resolve(__dirname, 'reserve/app'),
      '@features': path.resolve(__dirname, 'reserve/features'),
      '@entities': path.resolve(__dirname, 'reserve/entities'),
      '@shared': path.resolve(__dirname, 'reserve/shared'),
      '@pages': path.resolve(__dirname, 'reserve/pages'),
      '@tests': path.resolve(__dirname, 'reserve/tests'),
    };

    return config;
  },
};

module.exports = nextConfig;
