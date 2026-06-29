// design-sync preview shim for next/link — renders a plain anchor so DS
// components that link still render in the static preview (no Next router).
import * as React from 'react';

const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
  { href, children, replace, scroll, prefetch, shallow, passHref, locale, ...rest },
  ref,
) {
  const to = typeof href === 'string' ? href : href?.pathname || '#';
  return (
    <a ref={ref} href={to} {...rest}>
      {children}
    </a>
  );
});

export default Link;
