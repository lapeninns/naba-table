import { Footer } from '@/components/layouts/Footer';
import { guestBody, guestHeading } from '@/components/layouts/guest-font';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

type MarketingLayoutProps = {
  children: React.ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
};

export function MarketingLayout({
  children,
  showNavbar = true,
  showFooter = true,
}: MarketingLayoutProps) {
  return (
    <ThemeProvider theme="guest">
      <div
        className={cn(
          guestBody.variable,
          guestHeading.variable,
          'guest-theme luminous-shell relative min-h-screen min-h-[100svh] bg-background text-foreground [font-family:var(--font-guest-body)]',
        )}
      >
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-transparent">
          {showNavbar ? <GuestNavbar /> : null}
          <main id="main-content" className="flex-1">
            {children}
          </main>
          {showFooter ? <Footer variant="marketing" /> : null}
        </div>
      </div>
    </ThemeProvider>
  );
}
