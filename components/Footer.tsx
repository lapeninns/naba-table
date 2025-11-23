import Image from "next/image";
import Link from "next/link";

import config from "@/config";
import logo from "@/app/icon.png";

type FooterProps = {
  variant?: "default" | "auth" | "app" | "marketing";
};

export default function Footer({ variant = "default" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const isAuth = variant === "auth";
  const isApp = variant === "app";
  const isMarketing = variant === "marketing";

  return (
    <footer
      className={
        isAuth
          ? "border-t border-slate-200 bg-white py-8"
          : isApp
            ? "border-t border-slate-200 bg-white py-10"
            : isMarketing
              ? "border-t border-slate-200 bg-slate-50/60 py-10"
              : "border-t border-slate-200 bg-slate-50/50 py-10"
      }
    >
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-left md:px-6">
        <Link href="/guest/dashboard" className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
          <Image src={logo} alt={config.appName} width={24} height={24} />
          <span className="font-semibold text-slate-700">{config.appName}</span>
        </Link>

        <div className="flex flex-col items-center gap-3 text-sm text-slate-600 sm:flex-row sm:gap-5">
          <span className="text-xs sm:text-sm">© {currentYear} {config.appName}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
