import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { SETTINGS_CHANGE_UNIT, type SettingsSaveUnit } from './SettingsSaveBar';
import {
  pluralise,
  type SettingsSaveFailure,
  type SettingsSaveProgress,
} from './settingsSaveSequence';

import type { ReactNode } from 'react';

type SettingsStatusLineProps = {
  changeCount: number;
  unit?: SettingsSaveUnit;
  issueCount?: number;
  progress: SettingsSaveProgress | null;
  failure: SettingsSaveFailure | null;
  /** ISO timestamp of the last confirmed save, when the API reports one. */
  lastSavedAt?: string | null;
  /** Page facts shown after the status, e.g. "Open 6 days a week". */
  children?: ReactNode;
  className?: string;
};

export function formatSettingsSavedAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(parsed)
    .replace(/,(?=[^,]*,)/, '');
}

/**
 * Page-level save status under the page purpose line: saved, unsaved, saving or not all saved.
 * Colour is never the only signal; every state is a text label.
 */
export function SettingsStatusLine({
  changeCount,
  unit = SETTINGS_CHANGE_UNIT,
  issueCount = 0,
  progress,
  failure,
  lastSavedAt,
  children,
  className,
}: SettingsStatusLineProps) {
  let status: ReactNode;
  if (progress) {
    status = (
      <Badge variant="status-pending" className="whitespace-normal">
        Saving {progress.step} of {progress.total}: {progress.sectionName}…
      </Badge>
    );
  } else if (failure) {
    status = (
      <Badge variant="status-cancelled" className="gap-1">
        <AlertTriangle className="size-3" aria-hidden />
        Not all changes saved
      </Badge>
    );
  } else if (changeCount > 0) {
    status = (
      <Badge variant="status-pending">
        {pluralise(changeCount, unit.singular, unit.plural)}
        {issueCount > 0 ? ` · ${pluralise(issueCount, 'issue')}` : null}
      </Badge>
    );
  } else {
    const savedAt = formatSettingsSavedAt(lastSavedAt);
    status = (
      <>
        <Badge variant="status-confirmed" className="gap-1">
          <CheckCircle2 className="size-3" aria-hidden />
          All changes saved
        </Badge>
        {savedAt ? <span className="tabular-nums">Last saved {savedAt}</span> : null}
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {status}
      {children}
    </div>
  );
}
