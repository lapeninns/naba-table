import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

type MarketingLayoutProps = {
  children: React.ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
  contentClassName?: string;
};

export function MarketingLayout({
  children,
  showNavbar = true,
  showFooter = true,
  contentClassName,
}: MarketingLayoutProps) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen min-h-[100svh] bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-surface">
          {showNavbar ? <GuestNavbar /> : null}
          <main id="main-content" className={cn('flex-1', contentClassName)}>
            {children}
          </main>
          {showFooter ? <Footer variant="marketing" /> : null}
        </div>
      </div>
    </ThemeProvider>
  );
}
