type ThemeChangeListener = (event: { matches: boolean }) => void;
type ThemeMedia = {
  matches: boolean;
  addEventListener: (type: 'change', listener: ThemeChangeListener) => void;
  removeEventListener: (type: 'change', listener: ThemeChangeListener) => void;
};

export function synchronizeSystemTheme(root: HTMLElement, media: ThemeMedia): () => void {
  const apply = (matches: boolean) => root.classList.toggle('dark', matches);
  const handleChange: ThemeChangeListener = (event) => apply(event.matches);

  apply(media.matches);
  media.addEventListener('change', handleChange);
  return () => media.removeEventListener('change', handleChange);
}
