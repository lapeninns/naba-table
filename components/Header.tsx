"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import logo from "@/app/icon.png";
import config from "@/config";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface HeaderProps {
  variant?: "marketing" | "app" | "auth";
}

export default function Header({ variant = "marketing" }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSupabaseSession();
  const supabase = getSupabaseBrowserClient();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/"); // Redirect to home after sign out
  };

  if (variant === "auth") {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-center px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Image src={logo} alt={config.appName} width={32} height={32} className="rounded-sm" />
            <span>{config.appName}</span>
          </Link>
        </div>
      </header>
    );
  }

  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href={isLoggedIn ? "/guest/bookings" : "/"} className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Image src={logo} alt={config.appName} width={32} height={32} className="rounded-sm" />
          <span>{config.appName}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {isLoggedIn ? (
            <>
              <Link href="/restaurants" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Browse
              </Link>
              <Link href="/guest/bookings" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                My Bookings
              </Link>
              <div className="flex items-center gap-2 pl-2">
                <Link href="/guest/profile">
                  <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 gap-2">
                    <UserIcon size={16} />
                    Profile
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-600 hover:text-red-600 gap-2">
                  <LogOut size={16} />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link href="/restaurants" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Restaurants
              </Link>
              <Link href="/product" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                How it works
              </Link>
              <div className="flex items-center gap-2 pl-2">
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">Sign in</Button>
                </Link>
                <Link href="/restaurants">
                  <Button size="sm">Find a table</Button>
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-md" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-6 space-y-4 shadow-lg absolute w-full left-0">
          {isLoggedIn ? (
            <>
              <Link href="/restaurants" className="block text-base font-medium text-slate-700 hover:text-primary px-2 py-1">
                Browse
              </Link>
              <Link href="/guest/bookings" className="block text-base font-medium text-slate-700 hover:text-primary px-2 py-1">
                My Bookings
              </Link>
              <Link href="/guest/profile" className="block text-base font-medium text-slate-700 hover:text-primary px-2 py-1">
                Profile
              </Link>
              <div className="pt-4 border-t border-slate-100 mt-2">
                <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 px-2">
                  <LogOut size={16} className="mr-2" />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link href="/restaurants" className="block text-base font-medium text-slate-700 hover:text-primary px-2 py-1">
                Restaurants
              </Link>
              <Link href="/product" className="block text-base font-medium text-slate-700 hover:text-primary px-2 py-1">
                How it works
              </Link>
              <div className="pt-4 flex flex-col gap-3">
                <Link href="/auth/signin" className="w-full">
                  <Button variant="outline" className="w-full justify-center">Sign in</Button>
                </Link>
                <Link href="/restaurants" className="w-full">
                  <Button className="w-full justify-center">Find a table</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

