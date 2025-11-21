import Footer from "@/components/Footer";
import Header from "@/components/Header";

export function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header variant="app" />
      <main className="flex-1 container mx-auto px-4 py-8 md:px-6">
        {children}
      </main>
      <Footer variant="app" />
    </div>
  );
}
