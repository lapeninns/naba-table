import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-theme pg-page relative min-h-[100dvh] text-foreground">
      <GuestBackground />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <GuestNavbar />
        <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer variant="auth" />
      </div>
    </div>
  );
}
