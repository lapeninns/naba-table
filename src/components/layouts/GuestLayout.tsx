import { Footer } from '@/components/layouts/Footer';
import { guestBody, guestHeading } from '@/components/layouts/guest-font';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

export function GuestLayout({ children }: { children: React.ReactNode }) {
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
          <GuestNavbar />
          <main id="main-content" className="flex-1 py-8 md:py-12">
            <div className="guest-boundary">{children}</div>
          </main>
          <Footer variant="app" />
        </div>
      </div>
    </ThemeProvider>
  );
}
