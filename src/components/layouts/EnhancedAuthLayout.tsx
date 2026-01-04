import Link from 'next/link';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { BrandIcon } from '@/components/shared/BrandIcon';

type EnhancedAuthLayoutProps = {
  children: React.ReactNode;
  variant: 'guest' | 'restaurant';
  defaultRedirect?: string;
};

export function EnhancedAuthLayout({
  children,
  variant,
  defaultRedirect,
}: EnhancedAuthLayoutProps) {
  const isGuest = variant === 'guest';

  return (
    <ThemeProvider theme={isGuest ? 'guest' : 'app'}>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 text-slate-900">
        {/* Ambient background effects */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.06),transparent_50%)]" />

        <ImplicitAuthHandler defaultRedirect={defaultRedirect ?? '/guest/dashboard'} />

        {/* Header/Navbar */}
        <header className="relative z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <BrandIcon size="sm" />
              <span className="text-lg font-bold text-slate-900">Nab a Table</span>
            </Link>

            <div className="flex items-center gap-4 text-sm">
              {isGuest ? (
                <>
                  <Link
                    href="/app/auth/signin"
                    className="hidden text-slate-600 transition-colors hover:text-slate-900 sm:block"
                  >
                    Restaurant owners
                  </Link>
                  <Link
                    href="/#features"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    Learn more
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="hidden text-slate-600 transition-colors hover:text-slate-900 sm:block"
                  >
                    Guest sign-in
                  </Link>
                  <Link
                    href="/#restaurants"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    View demo
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        {/* Main Content */}
        <main id="main-content" className="relative z-10 flex flex-1 flex-col">
          {children}
        </main>

        {/* Footer */}
        <footer className="relative z-20 border-t border-slate-200/60 bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Brand Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BrandIcon size="sm" />
                  <span className="font-bold text-slate-900">Nab a Table</span>
                </div>
                <p className="text-sm text-slate-600">
                  {isGuest
                    ? 'Reserve the best tables without the back-and-forth.'
                    : 'Streamline your restaurant operations with powerful booking tools.'}
                </p>
              </div>

              {/* Product Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Product</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/restaurants"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Browse restaurants
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#features"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#how-it-works"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      How it works
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Company</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/about"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      About us
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/contact"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/partners"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Partner with us
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/privacy"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Privacy policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Terms of service
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cookies"
                      className="text-slate-600 transition-colors hover:text-blue-600"
                    >
                      Cookie policy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="flex flex-col items-center justify-between gap-4 text-sm text-slate-600 sm:flex-row">
                <p>© {new Date().getFullYear()} Nab a Table. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    </span>
                    All systems operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
