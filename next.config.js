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
      // --- Auth ---
      { source: "/signin", destination: "/auth/signin", permanent: true },
      { source: "/guest/signin", destination: "/auth/signin", permanent: true },
      { source: "/guest/auth/signin", destination: "/auth/signin", permanent: true },

      // --- Discovery & Restaurants ---
      { source: "/guest/restaurants", destination: "/restaurants", permanent: true },
      { source: "/guest/browse", destination: "/restaurants", permanent: true },
      { source: "/browse", destination: "/restaurants", permanent: true },
      { source: "/restaurant", destination: "/restaurants", permanent: true },
      { source: "/guest/restaurant", destination: "/restaurants", permanent: true },
      
      // --- Items ---
      { source: "/guest/item/:slug", destination: "/item/:slug", permanent: true },
      // Removed legacy /item/:slug -> /restaurants/:slug to enable the actual item page

      // --- Booking Flow ---
      // Specific /reserve/r/ must come before generic /reserve/:id
      { source: "/reserve/r/:slug", destination: "/restaurants/:slug/book", permanent: true },
      { source: "/book/:slug", destination: "/restaurants/:slug/book", permanent: true },
      
      { source: "/reserve", destination: "/bookings", permanent: true },
      { source: "/booking", destination: "/bookings", permanent: true },

      // Reservation detail -> /bookings/:id
      { source: "/reserve/:bookingId", destination: "/bookings/:bookingId", permanent: true },
      { source: "/guest/bookings/:bookingId", destination: "/bookings/:bookingId", permanent: true },
      
      // Legacy query param redirect for thank-you
      { source: "/thank-you", has: [{ type: "query", key: "bookingId", value: "(?<bookingId>.*)" }], destination: "/bookings/:bookingId/thank-you", permanent: true },

      // --- Guest Dashboard / Account ---
      { source: "/account", destination: "/guest", permanent: true },
      { source: "/account/bookings", destination: "/guest/bookings", permanent: true },
      { source: "/my-bookings", destination: "/guest/bookings", permanent: true },
      { source: "/guest/my-bookings", destination: "/guest/bookings", permanent: true },
      
      { source: "/account/profile", destination: "/guest/profile", permanent: true },
      { source: "/profile/manage", destination: "/guest/profile", permanent: true },
      
      // Invite (Preserve invite token flow, move to account/invite for now if that's where the page lives)
      { source: "/invite/:token", destination: "/account/invite/:token", permanent: true },

      // --- Ops ---
      { source: "/walk-in", destination: "/app/walk-in", permanent: true },

      // --- Legal ---
      { source: "/privacy-policy", destination: "/privacy-policy", permanent: true }, // Self-redirect? Likely to ensure trailing slash or specific normalization, keeping as is.
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
