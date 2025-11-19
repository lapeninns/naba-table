import Image from "next/image";
import Link from "next/link";

import logo from "@/app/icon.png";
import config from "@/config";

type FooterProps = {
  variant?: "default" | "compact";
};

function BrandMark() {
  return (
    <Link
      href="/"
      aria-current="page"
      className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image
        src={logo}
        alt={`${config.appName} logo`}
        priority
        className="h-6 w-6"
        width={24}
        height={24}
      />
      <strong className="font-extrabold tracking-tight text-base md:text-lg">
        {config.appName}
      </strong>
    </Link>
  );
}

const Footer = ({ variant = "default" }: FooterProps) => {
  const currentYear = new Date().getFullYear();
  const isCompact = variant === "compact" || variant === "default";

  if (isCompact) {
    return (
      <footer className="border-t border-border/70 bg-background/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
          <BrandMark />
          <p className="text-xs text-muted-foreground/80">
            © {currentYear} {config.appName}. All rights reserved.
          </p>
        </div>
      </footer>
    );
  }

  return null;
};

export default Footer;
