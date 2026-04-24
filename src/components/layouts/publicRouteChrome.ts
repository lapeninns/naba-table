export function isFocusedBookingFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }

  const normalized = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  return /^\/restaurants\/[^/]+\/book(?:\/thank-you)?$/.test(normalized);
}
