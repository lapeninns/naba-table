import { AlertCircle, RotateCcw, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from './shared';

export type AvailabilitySaveState = {
  variant: 'destructive' | 'success' | 'warning';
  title: string;
  message: string;
  details?: string[];
} | null;

export function AvailabilityScheduleHeader({
  hasLocalChanges,
  isScheduleWorkspace,
}: {
  readonly hasLocalChanges: boolean;
  readonly isScheduleWorkspace: boolean;
}) {
  return (
    <CardHeader
      className={cn(
        SETTINGS_COMPACT_CARD_HEADER_CLASS,
        'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
      )}
    >
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">
          {isScheduleWorkspace ? 'Weekly schedule' : 'Booking types'}
        </Badge>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">
            {isScheduleWorkspace
              ? 'Operating hours and service windows together'
              : 'Booking types and turn times'}
          </CardTitle>
          <CardDescription className="max-w-3xl">
            {isScheduleWorkspace
              ? 'Edit the outer open-close window, the nested lunch and dinner windows, and special date overrides from one working surface.'
              : 'Manage lunch, dinner, custom booking types, and party-size turn times without showing the full schedule editor.'}
          </CardDescription>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasLocalChanges ? (
          <Badge variant="metric" className="h-8 px-3">
            Unsaved changes in this section
          </Badge>
        ) : null}
      </div>
    </CardHeader>
  );
}

export function AvailabilitySaveAlert({
  saveState,
}: {
  readonly saveState: AvailabilitySaveState;
}) {
  if (!saveState) {
    return null;
  }

  return (
    <Alert variant={saveState.variant}>
      <AlertCircle className="size-4" />
      <AlertTitle>{saveState.title}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2">
          <p>{saveState.message}</p>
          {saveState.details?.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {saveState.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function RequiredBookingTypesAlert({
  isSaving,
  onCreateRequiredOccasions,
}: {
  readonly isSaving: boolean;
  readonly onCreateRequiredOccasions: () => void;
}) {
  return (
    <Alert variant="warning">
      <AlertCircle className="size-4" />
      <AlertTitle>Lunch and dinner booking types are required</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-3">
          <p>
            Operating hours can still be edited here, but service-window saves need active `Lunch`
            and `Dinner` booking types.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCreateRequiredOccasions}
            disabled={isSaving}
          >
            Create missing lunch and dinner booking types
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function AvailabilityScheduleFooter({
  canSave,
  hasLocalChanges,
  isSaving,
  onReset,
  onSave,
  saveState,
}: {
  readonly canSave: boolean;
  readonly hasLocalChanges: boolean;
  readonly isSaving: boolean;
  readonly onReset: () => void;
  readonly onSave: () => void;
  readonly saveState: AvailabilitySaveState;
}) {
  return (
    <CardFooter
      className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
    >
      <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
        <p>{formatSaveScopeMessage('availability-schedule')}</p>
        {saveState?.details?.length ? (
          <p>
            {saveState.details.length} save result detail
            {saveState.details.length === 1 ? '' : 's'} shown above.
          </p>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={isSaving || !hasLocalChanges}
        >
          <RotateCcw data-icon="inline-start" aria-hidden />
          Reset
        </Button>
        <Button type="button" onClick={onSave} disabled={!canSave}>
          <Save data-icon="inline-start" aria-hidden />
          Save configuration
        </Button>
      </div>
    </CardFooter>
  );
}
