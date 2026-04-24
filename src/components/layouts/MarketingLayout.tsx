import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';

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
    <div className="guest-theme pg-page relative min-h-[100dvh] text-foreground">
      <GuestBackground />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {showNavbar ? <GuestNavbar /> : null}
        <main id="main-content" className="flex-1">
          {children}
        </main>
        {showFooter ? <Footer variant="marketing" /> : null}
      </div>
    </div>
  );
}
