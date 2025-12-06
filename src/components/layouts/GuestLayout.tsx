import Footer from "@/components/layout/Footer";
import { GuestBackground } from "@/components/layouts/GuestBackground";
import { GuestNavbar } from "@/components/layouts/GuestNavbar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          <GuestNavbar />
          <main id="main-content" className="flex-1 py-8 md:py-12">
            <div className="container-default w-full px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <Footer variant="app" />
        </div>
      </div>
    </ThemeProvider>
  );
}
