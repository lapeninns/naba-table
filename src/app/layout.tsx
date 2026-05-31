import { Geist_Mono, Inter, Merriweather } from 'next/font/google';
import PlausibleProvider from 'next-plausible';
import { type CSSProperties, type ReactNode } from 'react';

import ClientLayout from '@/components/LayoutClient';
import config from '@/config';
import { APP_THEME_PATH_PATTERN } from '@/lib/theme/documentTheme';
import { getSEOTags } from '@/libs/seo';

import './globals.css';
import { AppProviders } from './providers';

import type { Viewport } from 'next';

const radixLumaDisplay = Merriweather({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-radix-luma-display',
  display: 'swap',
});

const radixLumaBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-radix-luma-body',
  display: 'swap',
});

const radixLumaMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-radix-luma-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  // Will use the primary color of your theme to show a nice theme color in the URL bar of supported browsers
  themeColor: config.colors.main,
  width: 'device-width',
  initialScale: 1,
};

// This adds default SEO tags to all pages in our app.
// You can override them in each page passing params to getSOTags() function.
export const metadata = getSEOTags();

const htmlStyle: CSSProperties = {
  transitionProperty: 'none',
  marginRight: '0px',
};

const documentThemeBootstrapScript = `(function(){var root=document.documentElement;var path=window.location.pathname||'/';var host=window.location.hostname||'';var normalized=(path.split('?')[0]||'/').replace(/\\/+$/,'')||'/';var appThemeHostRegex=new RegExp('^app(?:\\\\.|-)');var appThemePathRegex=new RegExp(${JSON.stringify(APP_THEME_PATH_PATTERN)});var theme=(appThemeHostRegex.test(host)||appThemePathRegex.test(normalized))?'app':'guest';root.setAttribute('data-theme',theme);if(theme==='guest'){root.classList.remove('dark');root.style.colorScheme='light';}else{root.style.removeProperty('color-scheme');}})();`;
const PLAUSIBLE_EXCLUDED_PATHS = '/invite/**';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={config.locale ?? 'en'}
      data-theme="guest"
      className={`${radixLumaDisplay.variable} ${radixLumaBody.variable} ${radixLumaMono.variable} antialiased font-sans`}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: documentThemeBootstrapScript }} />
        {config.domainName ? (
          <PlausibleProvider domain={config.domainName} exclude={PLAUSIBLE_EXCLUDED_PATHS} />
        ) : null}
      </head>
      <body className="relative font-sans" suppressHydrationWarning>
        {/* ClientLayout contains all the client wrappers (Crisp chat support, tooltips, etc.) */}
        <AppProviders initialSession={null}>
          <ClientLayout>{children}</ClientLayout>
        </AppProviders>
      </body>
    </html>
  );
}
