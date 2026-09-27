import { describe, expect, it } from 'vitest';

import {
  paginateRunSheet,
  type RunSheetFlowItem,
} from '@/components/features/dashboard/opsRunSheetPagination';

const group = (groupIndex: number, height = 10): RunSheetFlowItem => ({
  kind: 'group',
  groupIndex,
  height,
});
const row = (groupIndex: number, rowIndex: number, height = 10): RunSheetFlowItem => ({
  kind: 'row',
  groupIndex,
  rowIndex,
  height,
});

const describePages = (pages: ReturnType<typeof paginateRunSheet>) =>
  pages.map((page) =>
    page.map((item) =>
      item.kind === 'group'
        ? `G${item.groupIndex}${item.continued ? '+' : ''}`
        : `R${item.groupIndex}.${item.rowIndex}`,
    ),
  );

describe('paginateRunSheet', () => {
  it('keeps everything on one page when it fits', () => {
    const pages = paginateRunSheet({
      items: [group(0), row(0, 0), row(0, 1)],
      firstPageHeight: 100,
      nextPageHeight: 100,
      tableHeaderHeight: 10,
    });
    expect(describePages(pages)).toEqual([['G0', 'R0.0', 'R0.1']]);
  });

  it('repeats the group heading as continued when a group breaks across pages', () => {
    const pages = paginateRunSheet({
      items: [group(0), row(0, 0), row(0, 1), row(0, 2)],
      firstPageHeight: 40,
      nextPageHeight: 40,
      tableHeaderHeight: 10,
    });
    expect(describePages(pages)).toEqual([
      ['G0', 'R0.0', 'R0.1'],
      ['G0+', 'R0.2'],
    ]);
  });

  it('gives the first page less room than continuation pages', () => {
    const pages = paginateRunSheet({
      items: [row(0, 0), row(0, 1), row(0, 2), row(0, 3)],
      firstPageHeight: 30,
      nextPageHeight: 50,
      tableHeaderHeight: 10,
      grouped: false,
    });
    expect(describePages(pages)).toEqual([
      ['R0.0', 'R0.1'],
      ['R0.2', 'R0.3'],
    ]);
  });

  it('never strands a group heading at the foot of a page', () => {
    const pages = paginateRunSheet({
      items: [group(0), row(0, 0), group(1), row(1, 0)],
      firstPageHeight: 40,
      nextPageHeight: 40,
      tableHeaderHeight: 10,
    });
    expect(describePages(pages)).toEqual([
      ['G0', 'R0.0'],
      ['G1', 'R1.0'],
    ]);
  });

  it('places a row taller than a whole page instead of looping', () => {
    const pages = paginateRunSheet({
      items: [group(0), row(0, 0, 500), row(0, 1)],
      firstPageHeight: 40,
      nextPageHeight: 40,
      tableHeaderHeight: 10,
    });
    expect(describePages(pages)).toEqual([
      ['G0', 'R0.0'],
      ['G0+', 'R0.1'],
    ]);
  });

  it('moves a first row that only fits on a roomier continuation page, with its heading', () => {
    const pages = paginateRunSheet({
      items: [group(0), row(0, 0, 50), row(0, 1)],
      firstPageHeight: 40,
      nextPageHeight: 100,
      tableHeaderHeight: 10,
    });
    expect(describePages(pages)).toEqual([[], ['G0', 'R0.0', 'R0.1']]);
  });

  it('moves an oversized first ungrouped row to a continuation page when it fits there', () => {
    const pages = paginateRunSheet({
      items: [row(0, 0, 50)],
      firstPageHeight: 40,
      nextPageHeight: 100,
      tableHeaderHeight: 10,
      grouped: false,
    });
    expect(describePages(pages)).toEqual([[], ['R0.0']]);
  });

  it('returns a single empty page for an empty sheet', () => {
    expect(
      paginateRunSheet({
        items: [],
        firstPageHeight: 40,
        nextPageHeight: 40,
        tableHeaderHeight: 10,
      }),
    ).toEqual([[]]);
  });
});
