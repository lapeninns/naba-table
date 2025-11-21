import Link from "next/link";
import Image from "next/image";
import logo from "@/app/icon.png";
import config from "@/config";

interface FooterProps {
  variant?: "default" | "compact";
}

export default function Footer({ variant = "default" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="border-t border-slate-200 bg-slate-50/50 py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center md:px-6">
           <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <Image src={logo} alt={config.appName} width={24} height={24} />
              <span className="font-semibold text-slate-700">{config.appName}</span>
           </Link>
           <p className="text-xs text-slate-500">
             © {currentYear} {config.appName}. All rights reserved.
           </p>
        </div>
      </footer>
    );
  }
  
  return (
    <footer className="border-t border-slate-200 bg-slate-50/50">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
           <Link href="/" className="flex items-center gap-2">
              <Image src={logo} alt={config.appName} width={24} height={24} className="opacity-80 hover:opacity-100 transition-opacity"/>
              <span className="font-semibold text-slate-700">{config.appName}</span>
           </Link>
           
           <div className="flex gap-6 text-sm text-slate-600">
              <Link href="/restaurants" className="hover:text-slate-900 transition-colors">Restaurants</Link>
              <Link href="/auth/signin" className="hover:text-slate-900 transition-colors">Sign in</Link>
              <Link href="/product" className="hover:text-slate-900 transition-colors">About</Link>
           </div>
        </div>
        
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 border-t border-slate-200 pt-8">
           <p>© {currentYear} {config.appName}. All rights reserved.</p>
           <div className="flex gap-4">
              <Link href="/privacy-policy" className="hover:text-slate-700">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-700">Terms</Link>
           </div>
        </div>
      </div>
    </footer>
  );
}

