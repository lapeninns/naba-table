export function clearProfileUrlHash() {
  if (typeof window === 'undefined' || !window.location.hash) {
    return;
  }

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
