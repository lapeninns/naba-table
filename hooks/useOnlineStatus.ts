import { useEffect, useState } from 'react';

/**
 * useOnlineStatus — detects browser offline/online state with SSR safety.
 *
 * The first render deliberately falls back to `true` so that server-rendered HTML
 * matches the client's initial tree, preventing hydration mismatches when the
 * real network status is only known after hydration.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setIsOnline(true);
      return;
    }

    const resolveStatus = () => setIsOnline(navigator.onLine);
    resolveStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline ?? true;
}

export default useOnlineStatus;
