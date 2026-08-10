import { Geist_Mono, Inter, Merriweather } from 'next/font/google';
import Script from 'next/script';
import PlausibleProvider from 'next-plausible';
import { type CSSProperties, type ReactNode } from 'react';

import config from '@/config';
import { APP_THEME_PATH_PATTERN } from '@/lib/theme/documentTheme';
import { getSEOTags } from '@/libs/seo';

import './globals.css';
import { AppProviders } from './providers';
import ClientLayout from '../../components/LayoutClient';

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

// Sets the surface theme (guest/app, by host/path) AND the color mode (light/dark).
// Color mode is orthogonal to the surface and opt-in: no stored preference stays light;
// 'dark' forces dark; 'system' follows the OS. Runs before paint to avoid a flash.
const documentThemeBootstrapScript = `(function(){var root=document.documentElement;var path=window.location.pathname||'/';var host=window.location.hostname||'';var normalized=(path.split('?')[0]||'/').replace(/\\/+$/,'')||'/';var appThemeHostRegex=new RegExp('^app(?:\\\\.|-)');var appThemePathRegex=new RegExp(${JSON.stringify(APP_THEME_PATH_PATTERN)});var theme=(appThemeHostRegex.test(host)||appThemePathRegex.test(normalized))?'app':'guest';root.setAttribute('data-theme',theme);var mode=null;try{mode=localStorage.getItem('nabatable-color-mode');}catch(e){}var systemDark=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var dark=mode==='dark'||(mode==='system'&&systemDark);if(dark){root.classList.add('dark');root.style.colorScheme='dark';}else{root.classList.remove('dark');root.style.colorScheme='light';}})();`;
export const PLAUSIBLE_EXCLUDED_PATHS = [
  '/invite/**',
  '/**/google-business-profile',
  '/**/google-business-profile/**',
  '/**/dual-sync',
  '/**/dual-sync/**',
  '/**/gbp',
  '/**/gbp/**',
].join(',');

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
        {process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== '1' ? (
          <>
            <Script
              src="//unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="//unpkg.com/react-scan/dist/auto.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        ) : null}
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
