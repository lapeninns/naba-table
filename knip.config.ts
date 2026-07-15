import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        'src/app/**/{page,layout,route,error,loading,not-found}.tsx',
        'src/app/**/route.ts',
        'src/instrumentation.ts',
        'src/instrumentation-client.ts',
        'src/proxy.ts',
        'reserve/main.tsx',
        'scripts/**/*.{ts,mjs,cjs}',
        '*.{config,middleware}.{js,mjs,ts}',
      ],
      project: [
        '{app,components,config,context,hooks,lib,libs,reserve,scripts,server,src,types}/**/*.{ts,tsx,mjs,cjs}',
      ],
      ignore: [
        '**/*.stories.{ts,tsx}',
        'tests/**',
        'types/supabase.ts',
        'tasks/**',
        'backups/**',
      ],
      ignoreDependencies: ['@types/pg', 'pg'],
      ignoreBinaries: ['supabase', 'vercel'],
    },
    'cloudflare/*': {
      entry: ['src/index.{ts,mjs}'],
      project: ['src/**/*.{ts,mjs}'],
      ignoreDependencies: ['cloudflare'],
    },
  },
};

export default config;
