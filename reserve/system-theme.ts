type ThemeChangeListener = (event: { matches: boolean }) => void;
type ThemeMedia = {
  matches: boolean;
  addEventListener: (type: 'change', listener: ThemeChangeListener) => void;
  removeEventListener: (type: 'change', listener: ThemeChangeListener) => void;
};

const STORAGE_KEY = 'nabatable-color-mode';

function readMode(): 'light' | 'dark' | 'system' {
  try {
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* localStorage unavailable (private mode, etc.) */
  }
  return 'system';
}

/**
 * Keep the reserve bundle's `.dark` class in sync with the shared color-mode
 * preference and the OS. The preference (localStorage `nabatable-color-mode`)
 * is written by the main app's ThemeToggle; an explicit 'light'/'dark' choice
 * wins here too, and otherwise ('system' or unset) reserve follows the OS —
 * its long-standing default. Reacts to both OS changes and cross-tab toggles.
 */
export function synchronizeSystemTheme(root: HTMLElement, media: ThemeMedia): () => void {
  const apply = (systemDark: boolean) => {
    const mode = readMode();
    const dark = mode === 'dark' || (mode !== 'light' && systemDark);
    root.classList.toggle('dark', dark);
  };
  const handleChange: ThemeChangeListener = (event) => apply(event.matches);

  apply(media.matches);
  media.addEventListener('change', handleChange);

  const onStorage =
    typeof window !== 'undefined'
      ? (event: StorageEvent) => {
          if (event.key === STORAGE_KEY) apply(media.matches);
        }
      : undefined;
  if (onStorage) window.addEventListener('storage', onStorage);

  return () => {
    media.removeEventListener('change', handleChange);
    if (onStorage) window.removeEventListener('storage', onStorage);
  };
}
