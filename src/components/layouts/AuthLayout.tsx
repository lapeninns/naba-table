import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { AuthNavbar } from '@/components/layouts/AuthNavbar';
import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme pg-page relative min-h-[100dvh] text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <AuthNavbar />
          <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
          <main
            id="main-content"
            className="flex flex-1 items-center justify-center py-10 sm:py-12"
          >
            <div className="guest-boundary flex w-full justify-center">{children}</div>
          </main>
          <Footer variant="auth" />
        </div>
      </div>
    </ThemeProvider>
  );
}
