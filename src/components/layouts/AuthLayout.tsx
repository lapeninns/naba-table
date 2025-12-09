import { ImplicitAuthHandler } from "@/components/auth/ImplicitAuthHandler";
import Footer from "@/components/layout/Footer";
import { GuestBackground } from "@/components/layouts/GuestBackground";
import { GuestNavbar } from "@/components/layouts/GuestNavbar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen flex-col bg-surface">
          <GuestNavbar />
          <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
          <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
            {children}
          </main>
          <Footer variant="auth" />
        </div>
      </div>
    </ThemeProvider>
  );
}
