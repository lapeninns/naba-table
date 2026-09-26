/**
 * The ids of `entries` with the entry at `index` moved one place up (-1) or down (1). Returns
 * null when the move is out of range or an entry has no id yet.
 */
export function movedIds(
  entries: ReadonlyArray<{ id?: string }>,
  index: number,
  direction: -1 | 1,
): string[] | null {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return null;
  const ids = entries.map((entry) => entry.id);
  if (ids.some((id) => !id)) return null;
  const next = [...(ids as string[])];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
