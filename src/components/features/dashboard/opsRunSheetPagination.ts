/**
 * Flows measured run-sheet rows onto fixed-height A4 pages.
 *
 * Heights come from a hidden, unscaled render of the sheet, so the split matches what the
 * browser prints. The rules follow the paper run sheet: a group heading never sits alone at
 * the foot of a page, and a group that breaks across pages repeats its heading as
 * "continued" at the top of the next one.
 */

export type RunSheetFlowItem =
  | { kind: 'group'; groupIndex: number; height: number }
  | { kind: 'row'; groupIndex: number; rowIndex: number; height: number };

export type RunSheetPageItem =
  | { kind: 'group'; groupIndex: number; continued: boolean }
  | { kind: 'row'; groupIndex: number; rowIndex: number };

export type RunSheetPage = RunSheetPageItem[];

export function paginateRunSheet({
  items,
  firstPageHeight,
  nextPageHeight,
  tableHeaderHeight,
  grouped = true,
}: {
  items: RunSheetFlowItem[];
  /** Room for the table on page one, below the sheet header and stats. */
  firstPageHeight: number;
  /** Room for the table on continuation pages. */
  nextPageHeight: number;
  /** Column header height; it repeats on every page. */
  tableHeaderHeight: number;
  /** Whether rows sit under group headings that repeat when a group breaks. */
  grouped?: boolean;
}): RunSheetPage[] {
  const groupHeadingHeights = new Map<number, number>();
  for (const item of items) {
    if (item.kind === 'group') groupHeadingHeights.set(item.groupIndex, item.height);
  }

  const pages: RunSheetPage[] = [[]];
  let page = pages[0]!;
  let used = tableHeaderHeight;
  let capacity = firstPageHeight;

  const startPage = () => {
    page = [];
    pages.push(page);
    used = tableHeaderHeight;
    capacity = nextPageHeight;
  };

  for (const item of items) {
    if (item.kind === 'group') {
      if (used + item.height > capacity && page.length > 0) startPage();
      page.push({ kind: 'group', groupIndex: item.groupIndex, continued: false });
      used += item.height;
      continue;
    }

    const entry: RunSheetPageItem = {
      kind: 'row',
      groupIndex: item.groupIndex,
      rowIndex: item.rowIndex,
    };

    // A row that cannot fit even on a fresh page is placed anyway; moving it would loop.
    const onlyHeadings = page.every((existing) => existing.kind === 'group');
    if (used + item.height <= capacity || onlyHeadings) {
      page.push(entry);
      used += item.height;
      continue;
    }

    const last = page.at(-1);
    const orphan = last?.kind === 'group' && page.length > 1 ? page.pop() : undefined;
    startPage();

    if (orphan) {
      page.push(orphan);
      used += groupHeadingHeights.get(orphan.groupIndex) ?? 0;
    } else if (grouped && groupHeadingHeights.has(item.groupIndex)) {
      page.push({ kind: 'group', groupIndex: item.groupIndex, continued: true });
      used += groupHeadingHeights.get(item.groupIndex) ?? 0;
    }

    page.push(entry);
    used += item.height;
  }

  return pages;
}
