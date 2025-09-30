import { type CSSProperties, type ReactNode } from "react";
import { Viewport } from "next";
import PlausibleProvider from "next-plausible";
import { getSEOTags } from "@/libs/seo";
import ClientLayout from "@/components/LayoutClient";
import config from "@/config";
import "./globals.css";
import { AppProviders } from "./providers";

export const viewport: Viewport = {
  // Will use the primary color of your theme to show a nice theme color in the URL bar of supported browsers
  themeColor: config.colors.main,
  width: "device-width",
  initialScale: 1,
};

// This adds default SEO tags to all pages in our app.
// You can override them in each page passing params to getSOTags() function.
export const metadata = getSEOTags();

const htmlStyle: CSSProperties = {
  transitionProperty: "none",
  marginRight: "0px",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={config.locale ?? "en"}
      data-theme={config.colors.theme}
      className="antialiased font-sans"
      style={htmlStyle}
    >
      {config.domainName && (
        <head>
          <PlausibleProvider domain={config.domainName} />
        </head>
      )}
      <body className="relative font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* ClientLayout contains all the client wrappers (Crisp chat support, toast messages, tooltips, etc.) */}
        <AppProviders>
          <ClientLayout>{children}</ClientLayout>
        </AppProviders>
      </body>
    </html>
  );
}
