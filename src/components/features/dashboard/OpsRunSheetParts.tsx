import { Clock, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

import styles from './OpsBookingsPrintView.module.css';

import type {
  RunSheetGroup,
  RunSheetPreferences,
  RunSheetRow,
  RunSheetStatusTone,
} from './opsBookingsPrintViewDomain';

const TONE_CLASS: Record<RunSheetStatusTone, string | undefined> = {
  seated: styles.toneSeated,
  confirmed: styles.toneConfirmed,
  pending: styles.tonePending,
  done: styles.toneDone,
};

export function RunSheetStatusTags({ row }: { row: RunSheetRow }) {
  return (
    <>
      <span className={cn(styles.tag, TONE_CLASS[row.statusTone])}>{row.statusLabel}</span>
      {row.lateMinutes !== null ? (
        <span className={cn(styles.tag, styles.late)}>
          <Clock aria-hidden="true" strokeWidth={2} />
          Late · {row.lateMinutes} min
        </span>
      ) : null}
    </>
  );
}

export function RunSheetDietTags({ row }: { row: RunSheetRow }) {
  return (
    <>
      {row.allergies.map((allergy) => (
        <span key={`a-${allergy}`} className={cn(styles.tag, styles.allergy)}>
          <TriangleAlert aria-hidden="true" strokeWidth={2} />
          <span>
            <span className={styles.srOnly}>Allergy: </span>
            {allergy}
          </span>
        </span>
      ))}
      {row.dietary.map((diet) => (
        <span key={`d-${diet}`} className={cn(styles.tag, styles.diet)}>
          {diet}
        </span>
      ))}
    </>
  );
}

export function hasDietFlags(row: RunSheetRow) {
  return row.allergies.length > 0 || row.dietary.length > 0;
}

export function RunSheetUnassignedTag() {
  return <span className={cn(styles.tag, styles.unassigned)}>Unassigned</span>;
}

export function RunSheetTableCell({ row }: { row: RunSheetRow }) {
  if (row.tableNumbers.length === 0) {
    return row.isUnassigned ? <RunSheetUnassignedTag /> : <span className={styles.none}>–</span>;
  }
  return (
    <>
      <span className={styles.tableNumber}>{row.tableNumbers.join(' + ')}</span>
      {row.tableSections.length > 0 ? (
        <span className={styles.tableSection}>{row.tableSections.join(', ')}</span>
      ) : null}
    </>
  );
}

export function RunSheetGuestCell({
  row,
  columns,
}: {
  row: RunSheetRow;
  columns: RunSheetPreferences['columns'];
}) {
  return (
    <>
      <span className={styles.name}>{row.guestLabel}</span>
      {columns.ref && row.reference ? (
        <span className={styles.subLine}>{row.reference}</span>
      ) : null}
      {columns.phone && row.phone ? <span className={styles.subLine}>{row.phone}</span> : null}
    </>
  );
}

export function describeGroup(group: RunSheetGroup) {
  const count = group.rows.length;
  const parts = [
    group.spanLabel,
    `${count} ${count === 1 ? 'booking' : 'bookings'}`,
    `${group.covers} ${group.covers === 1 ? 'cover' : 'covers'}`,
  ];
  return parts.filter(Boolean).join(' · ');
}
