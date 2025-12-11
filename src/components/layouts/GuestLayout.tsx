import { Footer } from "@/components/layouts/Footer";
import { GuestBackground } from "@/components/layouts/GuestBackground";
import { GuestNavbar } from "@/components/layouts/GuestNavbar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen flex-col bg-surface">
          <GuestNavbar />
          <main id="main-content" className="flex-1 py-8 md:py-12">
            <div className="guest-boundary">
              {children}
            </div>
          </main>
          <Footer variant="app" />
        </div>
      </div>
    </ThemeProvider>
  );
}
