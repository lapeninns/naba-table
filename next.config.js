/** @type {import('next').NextConfig} */
const path = require('path');

const SUPABASE_HOSTNAME = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const imageDomains = [
  // NextJS <Image> component needs to whitelist domains for src={}
  'lh3.googleusercontent.com',
  'pbs.twimg.com',
  'images.unsplash.com',
  'logos-world.net',
];

if (SUPABASE_HOSTNAME && !imageDomains.includes(SUPABASE_HOSTNAME)) {
  imageDomains.push(SUPABASE_HOSTNAME);
}

const imageRemotePatterns = imageDomains.map((hostname) => ({
  protocol: 'https',
  hostname,
  pathname: '/**',
}));

const aliasEntries = {
  // Do not map `@/app` -> `./src/app` here: Turbopack (Next 16) can mis-infer the workspace root as
  // `src/app` and fail `next build`. Imports use `@/app/*` from tsconfig paths instead.
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
};

const webpackAliasMap = Object.fromEntries(
  Object.entries(aliasEntries).map(([key, relativePath]) => [
    key,
    path.resolve(__dirname, relativePath),
  ]),
);

const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: process.env.POSTHOG_SOURCEMAP_UPLOAD === 'true',
  serverExternalPackages: [],
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async redirects() {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'nabatable.com';

    const redirects = [
      // --- Auth ---
      { source: '/signin', destination: '/auth/signin', permanent: true },

      // --- Discovery & Restaurants ---
      { source: '/guest/restaurants', destination: '/restaurants', permanent: true },
      { source: '/guest/browse', destination: '/restaurants', permanent: true },
      { source: '/browse', destination: '/restaurants', permanent: true },
      { source: '/restaurant', destination: '/restaurants', permanent: true },
      { source: '/guest/restaurant', destination: '/restaurants', permanent: true },

      // --- Items ---
      { source: '/guest/item/:slug', destination: '/item/:slug', permanent: true },
      // Removed legacy /item/:slug -> /restaurants/:slug to enable the actual item page

      // --- Booking Flow ---
      // Specific /reserve/r/ must come before generic /reserve/:id
      { source: '/reserve/r/:slug', destination: '/restaurants/:slug/book', permanent: true },
      { source: '/book/:slug', destination: '/restaurants/:slug/book', permanent: true },

      { source: '/reserve', destination: '/bookings', permanent: true },
      { source: '/booking', destination: '/bookings', permanent: true },

      // Reservation detail -> /bookings/:id
      { source: '/reserve/:bookingId', destination: '/bookings/:bookingId', permanent: true },
      {
        source: '/guest/bookings/:bookingId',
        destination: '/bookings/:bookingId',
        permanent: true,
      },

      // Legacy query param redirect for thank-you
      {
        source: '/thank-you',
        has: [{ type: 'query', key: 'bookingId', value: '(?<bookingId>[^/]+)' }],
        destination: '/bookings/:bookingId/thank-you',
        permanent: true,
      },

      // --- Guest Dashboard / Account ---
      { source: '/account', destination: '/guest', permanent: true },
      { source: '/account/bookings', destination: '/guest/bookings', permanent: true },
      { source: '/my-bookings', destination: '/guest/bookings', permanent: true },
      { source: '/guest/my-bookings', destination: '/guest/bookings', permanent: true },

      { source: '/account/profile', destination: '/guest/profile', permanent: true },
      { source: '/profile/manage', destination: '/guest/profile', permanent: true },

      // --- Ops ---
      // --- Legal ---
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms', destination: '/', permanent: true },
      { source: '/tos', destination: '/', permanent: true },
      { source: '/terms/:path*', destination: '/', permanent: true },
    ];

    // --- WWW Canonicalization ---
    // Redirect naked domain to www (aligns with DNS/hosting provider settings)
    // Platform aliases are complete hostnames; a prefixed www alias is not provisioned.
    const hostedVercelDomain =
      rootDomain.toLowerCase() === 'vercel.app' || rootDomain.toLowerCase().endsWith('.vercel.app');
    if (
      rootDomain !== 'localhost' &&
      !hostedVercelDomain &&
      process.env.NODE_ENV === 'production'
    ) {
      redirects.unshift({
        source: '/:path*',
        has: [{ type: 'host', value: rootDomain }],
        destination: `https://www.${rootDomain}/:path*`,
        permanent: true,
      });
    }

    return redirects;
  },
  turbopack: {
    root: path.resolve(__dirname),
    // Used by `next dev --turbo`. Production `pnpm run build` uses webpack (see package.json) because
    // Next 16.1.x Turbopack can still fail with: inferred workspace root `src/app`, next/package.json not found.
    resolveAlias: webpackAliasMap,
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
