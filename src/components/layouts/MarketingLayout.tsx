import { Footer } from "@/components/layouts/Footer";
import { GuestBackground } from "@/components/layouts/GuestBackground";
import { GuestNavbar } from "@/components/layouts/GuestNavbar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

type MarketingLayoutProps = {
  children: React.ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
};

export function MarketingLayout({ children, showNavbar = true, showFooter = true }: MarketingLayoutProps) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen flex-col bg-surface">
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
