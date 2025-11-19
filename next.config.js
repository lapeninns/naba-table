/** @type {import('next').NextConfig} */
const path = require('path');

const SUPABASE_HOSTNAME = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

if (process.env.PLAYWRIGHT_TEST_AUTH_FLOW === 'true' && !process.env.NEXT_PUBLIC_FORCE_PASSWORD_SIGNIN) {
  process.env.NEXT_PUBLIC_FORCE_PASSWORD_SIGNIN = 'true';
}

const imageDomains = [
  // NextJS <Image> component needs to whitelist domains for src={}
  "lh3.googleusercontent.com",
  "pbs.twimg.com",
  "images.unsplash.com",
  "logos-world.net",
];

if (SUPABASE_HOSTNAME && !imageDomains.includes(SUPABASE_HOSTNAME)) {
  imageDomains.push(SUPABASE_HOSTNAME);
}

const imageRemotePatterns = imageDomains.map((hostname) => ({
  protocol: "https",
  hostname,
  pathname: "/**",
}));

const aliasEntries = {
  '@/app': './src/app',
  '@/components/features': './src/components/features',
  '@/components': './components',
  '@/contexts': './src/contexts',
  '@/hooks/ops': './hooks/ops',
  '@/hooks': './hooks',
  '@/lib': './lib',
  '@/utils': './src/utils',
  '@/services': './src/services',
  '@/types': './types',
  '@/server': './server',
  '@': './',
  '@reserve': './reserve',
  '@app': './reserve/app',
  '@features': './reserve/features',
  '@entities': './reserve/entities',
  '@shared': './reserve/shared',
  '@pages': './reserve/pages',
  '@tests': './reserve/tests',
};

const webpackAliasMap = Object.fromEntries(
  Object.entries(aliasEntries).map(([key, relativePath]) => [key, path.resolve(__dirname, relativePath)]),
);

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async redirects() {
    return [
      { source: "/my-bookings", destination: "/bookings", permanent: true },
      { source: "/profile/manage", destination: "/account/profile", permanent: true },
      { source: "/invite/:token", destination: "/account/invite/:token", permanent: true },
      { source: "/signin", destination: "/auth/signin", permanent: true },
      { source: "/browse", destination: "/restaurants", permanent: true },
      { source: "/restaurant", destination: "/restaurants", permanent: true },
      { source: "/item/:slug", destination: "/restaurants/:slug", permanent: true },
      { source: "/reserve", destination: "/bookings", permanent: true },
      { source: "/reserve/r/:slug", destination: "/restaurants/:slug/book", permanent: true },
      // Reservation detail lives at /bookings/[bookingId]; align param name to avoid redirect config errors.
      { source: "/reserve/:bookingId", destination: "/bookings/:bookingId", permanent: true },
      { source: "/thank-you", has: [{ type: "query", key: "bookingId", value: "(?<bookingId>.*)" }], destination: "/bookings/:bookingId/thank-you", permanent: true },
      // Legal fallbacks
      { source: "/privacy-policy", destination: "/privacy-policy", permanent: true },
      { source: "/terms", destination: "/terms", permanent: true },
      { source: "/tos", destination: "/terms", permanent: true },
      { source: "/terms/:path*", destination: "/terms", permanent: true },
    ];
  },
  turbopack: {
    resolveAlias: aliasEntries,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...webpackAliasMap,
    };

    return config;
  },
};

module.exports = nextConfig;
