import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Raw responsive state: `undefined` until the first client-side measurement,
 * then a boolean. Callers that must avoid an SSR/first-paint flip (e.g. a
 * table↔card swap) should branch on `undefined` and render a neutral skeleton
 * until the breakpoint is known, rather than treating "unknown" as desktop. (#7)
 */
export function useIsMobileState(breakpoint: number = MOBILE_BREAKPOINT): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    setIsMobile(window.innerWidth < breakpoint);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * Boolean convenience wrapper. Treats the pre-mount `undefined` as not-mobile,
 * which is fine for callers where a one-frame desktop default is harmless; use
 * {@link useIsMobileState} when the first-paint default would cause a visible
 * layout flip.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  return !!useIsMobileState(breakpoint);
}
