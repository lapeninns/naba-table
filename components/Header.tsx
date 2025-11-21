"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import logo from "@/app/icon.png";
import config from "@/config";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Image src={logo} alt={config.appName} width={32} height={32} className="rounded-sm" />
          <span>{config.appName}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
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
        </nav>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-md" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-6 space-y-4 shadow-lg absolute w-full left-0">
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
        </div>
      )}
    </header>
  );
}

