import { ImplicitAuthHandler } from "@/components/auth/ImplicitAuthHandler";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header variant="auth" />
      <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
      <Footer variant="auth" />
    </div>
  );
}
