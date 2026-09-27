'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import styles from './OpsBookingsPrintView.module.css';
import {
  planRunSheetColumns,
  type OpsRunSheet,
  type RunSheetColumn,
  type RunSheetColumnKey,
  type RunSheetPreferences,
  type RunSheetRow,
} from './opsBookingsPrintViewDomain';
import {
  paginateRunSheet,
  type RunSheetFlowItem,
  type RunSheetPage,
  type RunSheetPageItem,
} from './opsRunSheetPagination';
import {
  RunSheetDietTags,
  RunSheetGuestCell,
  RunSheetStatusTags,
  RunSheetTableCell,
  describeGroup,
  hasDietFlags,
} from './OpsRunSheetParts';

const PX_PER_MM = 96 / 25.4;
/** Rounding slack so sub-pixel row heights never push the last row past the page edge. */
const FIT_SLACK_PX = 1;

export type RunSheetPagesContent =
  | { kind: 'sheet'; sheet: OpsRunSheet }
  | { kind: 'message'; node: ReactNode; sheet: OpsRunSheet | null }
  | { kind: 'loading' };

type OpsRunSheetPagesProps = {
  content: RunSheetPagesContent;
  preferences: RunSheetPreferences;
  restaurantName: string;
  readableDate: string;
  printedLabel: string;
  asOfLabel: string | null;
  onLayoutChange?: (layout: { pageCount: number; scale: number }) => void;
};

type PagePlan = { key: object; pages: RunSheetPage[] };

export function OpsRunSheetPages({
  content,
  preferences,
  restaurantName,
  readableDate,
  printedLabel,
  asOfLabel,
  onLayoutChange,
}: OpsRunSheetPagesProps) {
  const columns = useMemo(() => planRunSheetColumns(preferences), [preferences]);
  const sheet = content.kind === 'loading' ? null : content.sheet;
  const flowSheet = content.kind === 'sheet' ? content.sheet : null;
  const landscape = preferences.paper === 'landscape';
  const pageClass = cn(
    styles.a4,
    landscape && styles.landscape,
    preferences.density === 'compact' && styles.compact,
  );

  // Identity of everything that changes the page split; the printed time and data age do not.
  const layoutKey = useMemo(
    () => ({ flowSheet, preferences, restaurantName, readableDate }),
    [flowSheet, preferences, restaurantName, readableDate],
  );
  const measureRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PagePlan | null>(null);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!flowSheet || !root) return;

    const measure = () => {
      const firstBody = root.querySelector<HTMLElement>('[data-measure="first-body"]');
      const nextBody = root.querySelector<HTMLElement>('[data-measure="next-body"]');
      const thead = root.querySelector<HTMLElement>('thead');
      if (!firstBody || !nextBody || !thead) return;

      const items: RunSheetFlowItem[] = [];
      root.querySelectorAll<HTMLElement>('tr[data-flow]').forEach((tr) => {
        const height = tr.getBoundingClientRect().height;
        const groupIndex = Number(tr.dataset.group);
        if (tr.dataset.flow === 'group') items.push({ kind: 'group', groupIndex, height });
        else items.push({ kind: 'row', groupIndex, rowIndex: Number(tr.dataset.row), height });
      });

      setPlan({
        key: layoutKey,
        pages: paginateRunSheet({
          items,
          firstPageHeight: firstBody.clientHeight - FIT_SLACK_PX,
          nextPageHeight: nextBody.clientHeight - FIT_SLACK_PX,
          tableHeaderHeight: thead.getBoundingClientRect().height,
          grouped: flowSheet.groups.some((group) => group.label !== null),
        }),
      });
    };

    measure();
    let cancelled = false;
    // Web fonts change line heights; measure again once they have loaded.
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [flowSheet, layoutKey]);

  const pages: RunSheetPage[] | null = flowSheet && plan?.key === layoutKey ? plan.pages : null;
  const pageCount = flowSheet ? (pages?.length ?? 1) : 1;

  // Scale the preview to the available width; print always uses full size.
  const hostRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  const pageWidthPx = (landscape ? 297 : 210) * PX_PER_MM;
  const pageHeightPx = (landscape ? 210 : 297) * PX_PER_MM;
  const scale = availableWidth ? Math.min(1, availableWidth / pageWidthPx) : 1;

  useEffect(() => {
    onLayoutChange?.({ pageCount, scale });
  }, [onLayoutChange, pageCount, scale]);

  const renderPage = (index: number, total: number, body: ReactNode) => (
    <div
      key={index}
      className={styles.slot}
      style={{ width: pageWidthPx * scale, height: pageHeightPx * scale }}
    >
      <article
        className={pageClass}
        aria-label={`Page ${index + 1} of ${total}`}
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {index === 0 ? (
          <FirstPageHeader
            restaurantName={restaurantName}
            readableDate={readableDate}
            sheet={sheet}
            printedLabel={printedLabel}
            asOfLabel={asOfLabel}
          />
        ) : (
          <ContinuationHeader restaurantName={restaurantName} readableDate={readableDate} />
        )}
        <div className={styles.body}>{body}</div>
        <PageFooter index={index} total={total} />
      </article>
    </div>
  );

  let rendered: ReactNode;
  if (content.kind === 'loading') {
    rendered = renderPage(
      0,
      1,
      <div className={styles.skeleton} aria-busy="true">
        <span className={styles.srOnly}>Loading bookings</span>
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} />
        ))}
      </div>,
    );
  } else if (content.kind === 'message') {
    rendered = renderPage(0, 1, content.node);
  } else {
    const allItems: RunSheetPageItem[][] = pages ?? [flattenAll(content.sheet)];
    rendered = allItems.map((items, index) =>
      renderPage(
        index,
        allItems.length,
        <RunTable
          sheet={content.sheet}
          columns={columns}
          preferences={preferences}
          items={items}
          readableDate={readableDate}
        />,
      ),
    );
  }

  return (
    <div ref={hostRef}>
      <div id="ops-print-root" className={styles.pages}>
        {rendered}
      </div>
      <style>{`@page { size: A4 ${preferences.paper}; margin: 0; }`}</style>
      {flowSheet ? (
        <div ref={measureRef} className={styles.measure} aria-hidden="true">
          <article className={pageClass}>
            <FirstPageHeader
              restaurantName={restaurantName}
              readableDate={readableDate}
              sheet={flowSheet}
              printedLabel={printedLabel}
              asOfLabel={asOfLabel}
            />
            <div className={styles.body} data-measure="first-body">
              <RunTable
                sheet={flowSheet}
                columns={columns}
                preferences={preferences}
                items={flattenAll(flowSheet)}
                readableDate={readableDate}
                measuring
              />
            </div>
            <PageFooter index={0} total={1} />
          </article>
          <article className={pageClass}>
            <ContinuationHeader restaurantName={restaurantName} readableDate={readableDate} />
            <div className={styles.body} data-measure="next-body" />
            <PageFooter index={1} total={2} />
          </article>
        </div>
      ) : null}
    </div>
  );
}

function flattenAll(sheet: OpsRunSheet): RunSheetPageItem[] {
  return sheet.groups.flatMap((group, groupIndex) => [
    ...(group.label ? [{ kind: 'group' as const, groupIndex, continued: false }] : []),
    ...group.rows.map((_, rowIndex) => ({ kind: 'row' as const, groupIndex, rowIndex })),
  ]);
}

function FirstPageHeader({
  restaurantName,
  readableDate,
  sheet,
  printedLabel,
  asOfLabel,
}: {
  restaurantName: string;
  readableDate: string;
  sheet: OpsRunSheet | null;
  printedLabel: string;
  asOfLabel: string | null;
}) {
  const criteria = sheet?.criteria;
  const stats = sheet?.stats;
  const statEntries: [string, number | undefined][] = [
    ['Bookings', stats?.bookings],
    ['Covers', stats?.covers],
    ['Lunch covers', stats?.lunchCovers],
    ['Dinner covers', stats?.dinnerCovers],
    ['Allergy flags', stats?.allergyFlags],
    ['Unassigned', stats?.unassigned],
  ];

  return (
    <>
      <header className={styles.head}>
        <div>
          <p className={styles.venue}>{restaurantName}</p>
          <h2 className={styles.title}>Bookings · {readableDate}</h2>
          {criteria ? (
            <p className={styles.criteria}>
              Filter <b>{criteria.filterLabel}</b> · Sorted by {criteria.sortLabel},{' '}
              {criteria.sortDirLabel}
              {criteria.search ? (
                <>
                  {' '}
                  · Search <b>“{criteria.search}”</b>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className={styles.printed}>
          <div>
            Printed <span className={styles.mono}>{printedLabel}</span>
          </div>
          {asOfLabel ? (
            <div>
              Data as of <span className={styles.mono}>{asOfLabel}</span>
            </div>
          ) : null}
        </div>
      </header>
      <dl className={styles.stats}>
        {statEntries.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function ContinuationHeader({
  restaurantName,
  readableDate,
}: {
  restaurantName: string;
  readableDate: string;
}) {
  return (
    <header className={styles.contHead}>
      <div>
        <b>Bookings · {readableDate}</b> <span>(continued)</span>
      </div>
      <span>{restaurantName}</span>
    </header>
  );
}

function PageFooter({ index, total }: { index: number; total: number }) {
  return (
    <footer className={styles.foot}>
      <span>Nabatable · Covers exclude cancelled bookings and no-shows</span>
      <span className={styles.pageNumber}>
        Page {index + 1} of {total}
      </span>
    </footer>
  );
}

const COLUMN_CLASS: Partial<Record<RunSheetColumnKey, string | undefined>> = {
  time: styles.cTime,
  party: styles.cParty,
  table: styles.cTable,
};

function RunTable({
  sheet,
  columns,
  preferences,
  items,
  readableDate,
  measuring = false,
}: {
  sheet: OpsRunSheet;
  columns: RunSheetColumn[];
  preferences: RunSheetPreferences;
  items: RunSheetPageItem[];
  readableDate: string;
  measuring?: boolean;
}) {
  return (
    <Table className={styles.run}>
      <TableCaption className={styles.srOnly}>Bookings for {readableDate}</TableCaption>
      <colgroup>
        {columns.map((column) => (
          <col
            key={column.key}
            style={column.widthMm ? { width: `${column.widthMm}mm` } : undefined}
          />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} scope="col" className={COLUMN_CLASS[column.key]}>
              {column.labelHidden ? (
                <span className={styles.srOnly}>{column.label}</span>
              ) : (
                column.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const group = sheet.groups[item.groupIndex];
          if (!group) return null;
          if (item.kind === 'group') {
            return (
              <TableRow
                key={`g-${item.groupIndex}-${item.continued ? 'c' : 'h'}`}
                className={styles.groupRow}
                data-flow={measuring ? 'group' : undefined}
                data-group={measuring ? item.groupIndex : undefined}
              >
                <TableHead colSpan={columns.length} scope="colgroup">
                  {group.label}
                  {item.continued ? ' (continued)' : ''}
                  <span className={styles.groupMeta}>{describeGroup(group)}</span>
                </TableHead>
              </TableRow>
            );
          }
          const row = group.rows[item.rowIndex];
          if (!row) return null;
          return (
            <TableRow
              key={row.id}
              className={cn(row.category === 'finished' && styles.done)}
              data-flow={measuring ? 'row' : undefined}
              data-group={measuring ? item.groupIndex : undefined}
              data-row={measuring ? item.rowIndex : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} className={COLUMN_CLASS[column.key]}>
                  <RunCell column={column.key} row={row} preferences={preferences} />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RunCell({
  column,
  row,
  preferences,
}: {
  column: RunSheetColumnKey;
  row: RunSheetRow;
  preferences: RunSheetPreferences;
}) {
  const { columns } = preferences;
  switch (column) {
    case 'tick':
      return <span className={styles.tickbox} aria-hidden="true" />;
    case 'time':
      return (
        <>
          <span className={styles.start}>{row.startLabel}</span>
          {row.endLabel ? <span className={styles.end}>–{row.endLabel}</span> : null}
        </>
      );
    case 'guest':
      return <RunSheetGuestCell row={row} columns={columns} />;
    case 'party':
      return <>{row.partySize}</>;
    case 'table':
      return <RunSheetTableCell row={row} />;
    case 'status':
      return (
        <div className={styles.tags}>
          <RunSheetStatusTags row={row} />
        </div>
      );
    case 'diet':
      return hasDietFlags(row) ? (
        <div className={styles.tags}>
          <RunSheetDietTags row={row} />
        </div>
      ) : (
        <span className={styles.none}>None recorded</span>
      );
    case 'notes':
      return row.notes ? <>{row.notes}</> : <span className={styles.none}>–</span>;
    case 'detail': {
      const showDiet = columns.diet && hasDietFlags(row);
      const showNotes = columns.notes && row.notes;
      if (!showDiet && !showNotes) return <span className={styles.none}>–</span>;
      return (
        <>
          {showDiet ? (
            <div className={styles.tags}>
              <RunSheetDietTags row={row} />
            </div>
          ) : null}
          {showNotes ? <span className={styles.detailNotes}>{row.notes}</span> : null}
        </>
      );
    }
  }
}
