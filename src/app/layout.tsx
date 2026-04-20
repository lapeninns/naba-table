import PlausibleProvider from 'next-plausible';
import { type CSSProperties, type ReactNode } from 'react';

import ClientLayout from '@/components/LayoutClient';
import config from '@/config';
import { getSEOTags } from '@/libs/seo';

import './globals.css';
import { AppProviders } from './providers';

import type { Viewport } from 'next';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={config.locale ?? 'en'} className="antialiased font-sans" style={htmlStyle}>
      {config.domainName && (
        <head>
          <PlausibleProvider domain={config.domainName} />
        </head>
      )}
      <body className="relative font-sans" suppressHydrationWarning>
        {/* ClientLayout contains all the client wrappers (Crisp chat support, tooltips, etc.) */}
        <AppProviders initialSession={null}>
          <ClientLayout>{children}</ClientLayout>
        </AppProviders>
      </body>
    </html>
  );
}
