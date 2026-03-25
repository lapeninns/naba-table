import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

export function GuestLayout({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen min-h-[100svh] bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-surface">
          <GuestNavbar />
          <main id="main-content" className={cn('flex-1 py-8 md:py-12', contentClassName)}>
            <div className="guest-boundary">{children}</div>
          </main>
          <Footer variant="app" />
        </div>
      </div>
    </ThemeProvider>
  );
}
