export const isMeta = (event: KeyboardEvent) => event.metaKey || event.ctrlKey;
export const isEditableTarget = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.getAttribute('contenteditable') === 'true';
};
