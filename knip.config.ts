import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    // Next.js entry points
    'src/app/**/page.tsx',
    'src/app/**/layout.tsx',
    'src/app/**/route.ts',
    'src/app/**/error.tsx',
    'src/app/**/loading.tsx',
    'src/app/**/not-found.tsx',
    'src/app/global-error.tsx',
    'src/instrumentation.ts',
    'src/instrumentation-client.ts',
    'src/middleware.ts',

    // Reserve package (Vite)
    'reserve/main.tsx',

    // Config files
    'next.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'eslint.config.mjs',

    // Scripts
    'scripts/**/*.ts',
    'scripts/**/*.mjs',
    'scripts/**/*.cjs',
  ],
  project: [
    'src/**/*.{ts,tsx}',
    'server/**/*.ts',
    'lib/**/*.ts',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'reserve/**/*.{ts,tsx}',
    'types/**/*.ts',
    'config/**/*.ts',
  ],
  ignore: [
    // Build outputs
    '.next/**',
    'dist/**',
    '.reserve-dist/**',
    'node_modules/**',

    // Generated files
    'types/supabase.ts',

    // Backup files
    'backups/**',
    '**/*.backup.*',

    // Task artifacts
    'tasks/**',

    // Test files (currently removed)
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    'tests/**',
  ],
  ignoreDependencies: [
    // Peer dependencies
    'react',
    'react-dom',

    // PostCSS plugins (loaded by config)
    'autoprefixer',

    // CLI tools used in scripts
    'tsx',
    'ts-node',
    'dotenv-cli',

    // Storybook addons (loaded dynamically)
    '@storybook/react',
    '@storybook/react-vite',
    'storybook',

    // Build tools
    'typescript',
    'eslint',
    'prettier',

    // Sentry (loaded via instrumentation)
    '@sentry/nextjs',
  ],
  ignoreBinaries: [
    'supabase',
    'vercel',
  ],
  // Plugin configurations
  next: {
    entry: [
      'src/app/**/page.tsx',
      'src/app/**/layout.tsx',
      'src/app/**/route.ts',
      'src/middleware.ts',
    ],
  },
};

export default config;
