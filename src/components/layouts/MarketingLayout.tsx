import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1">
        {children}
      </main>
      <Footer variant="marketing" />
    </div>
  );
}
