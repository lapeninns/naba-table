import PlausibleProvider from 'next-plausible';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Geist_Mono: () => ({ variable: 'font-mono' }),
  Inter: () => ({ variable: 'font-body' }),
  Merriweather: () => ({ variable: 'font-display' }),
}));

vi.mock('../../src/app/globals.css', () => ({}));

vi.mock('next/script', () => ({
  default: (props: React.ComponentProps<'script'>) => <script {...props} />,
}));

vi.mock('../../components/LayoutClient', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/src/app/providers', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/config', () => ({
  default: {
    locale: 'en',
    domainName: 'nabatable.example',
    colors: { main: '#000000' },
  },
}));

vi.mock('@/libs/seo', () => ({ getSEOTags: () => ({}) }));
vi.mock('@/lib/theme/documentTheme', () => ({ APP_THEME_PATH_PATTERN: '^/app' }));

import { PLAUSIBLE_EXCLUDED_PATHS } from '@/src/app/layout';

describe('root analytics privacy configuration', () => {
  it('renders Plausible exclusions through its supported data-exclude contract', () => {
    const provider = PlausibleProvider as unknown as (props: {
      enabled: boolean;
      domain: string;
      exclude: string;
    }) => React.ReactNode;
    const providerTree = provider({
      enabled: true,
      domain: 'nabatable.example',
      exclude: PLAUSIBLE_EXCLUDED_PATHS,
    }) as React.ReactElement<{ children: React.ReactNode[] }>;
    const script = providerTree.props.children[0] as React.ReactElement<{
      'data-exclude': string;
      src: string;
    }>;
    const patterns = PLAUSIBLE_EXCLUDED_PATHS.split(',');

    expect(patterns).toEqual(
      expect.arrayContaining([
        '/**/google-business-profile',
        '/**/google-business-profile/**',
        '/**/dual-sync/**',
        '/**/gbp/**',
      ]),
    );
    expect(script.props['data-exclude']).toBe(PLAUSIBLE_EXCLUDED_PATHS);
    expect(script.props.src).toMatch(/script\.exclusions(?:\.js)?/);
  });
});
