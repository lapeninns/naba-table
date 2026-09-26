'use client';

import { Loader2, Send } from 'lucide-react';
import { useLayoutEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';

import { useRestaurantSettingsSaveBarSlot } from '../../RestaurantSettingsSaveBarSlot';

export type GbpDecisionBarProps = {
  readonly toSend: number;
  readonly toImport: number;
  readonly ignored: number;
  readonly undecided: number;
  /** Why sending is unavailable, when it is. */
  readonly sendBlockReason: string | null;
  /** "Use Google's" choices can be saved (nothing running, sync not paused). */
  readonly canImport: boolean;
  /** "Send to Google" choices exist and nothing blocks sending (a running preview aside). */
  readonly canPreview: boolean;
  readonly previewPending: boolean;
  readonly importPending: boolean;
  readonly onImport: () => void;
  readonly onPreview: () => void;
};

function outcomeLine({
  toSend,
  toImport,
  sendBlockReason,
}: Pick<GbpDecisionBarProps, 'toSend' | 'toImport' | 'sendBlockReason'>): string {
  if (sendBlockReason && (toSend > 0 || toImport === 0)) return sendBlockReason;
  if (toSend > 0) return 'You’ll see the exact plan before anything is sent to Google.';
  if (toImport > 0)
    return 'Google’s values are saved in Nabatable only. Nothing is sent to Google.';
  return 'Choose what to do with each difference.';
}

function Bar(props: GbpDecisionBarProps) {
  const { toSend, toImport, ignored, undecided } = props;
  return (
    <div
      role="region"
      aria-label="Publish decisions"
      data-testid="gbp-decision-bar"
      className="z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t bg-background/95 px-[var(--ops-shell-gutter)] py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-background/90"
    >
      <p className="min-w-0 flex-[1_1_320px] text-sm" role="status" aria-live="polite">
        <b className="font-semibold tabular-nums">
          {toSend} to send to Google · {toImport} to use from Google · {ignored} ignored
        </b>
        {undecided ? <span className="tabular-nums"> · {undecided} undecided</span> : null}
        <span className="block text-xs text-muted-foreground">{outcomeLine(props)}</span>
      </p>
      <div className="ml-auto flex flex-wrap gap-2">
        {toImport ? (
          <Button
            type="button"
            variant="outline"
            data-gbp-action="import"
            onClick={props.onImport}
            disabled={!props.canImport || props.importPending}
          >
            {props.importPending ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {props.importPending
              ? 'Saving…'
              : `Save ${toImport} Google ${toImport === 1 ? 'value' : 'values'} in Nabatable`}
          </Button>
        ) : null}
        <Button
          type="button"
          data-gbp-action="preview"
          // Stays focusable while the plan is prepared, so focus returns here when the plan
          // dialog closes (a disabled button drops focus).
          onClick={props.previewPending ? undefined : props.onPreview}
          disabled={!props.canPreview}
          aria-disabled={props.previewPending || undefined}
          aria-busy={props.previewPending || undefined}
        >
          {props.previewPending ? (
            <Loader2
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Send data-icon="inline-start" aria-hidden />
          )}
          {props.previewPending ? 'Preparing plan…' : `Review exact plan (${toSend})`}
        </Button>
      </div>
    </div>
  );
}

/**
 * The review tab's pinned decision bar: counts of each choice and the two ways to act on them.
 * Docked below the settings scroll area, like the other settings save bars.
 */
export function GbpDecisionBar(props: GbpDecisionBarProps) {
  const slot = useRestaurantSettingsSaveBarSlot();
  const bar = useMemo(() => <Bar {...props} />, [props]);

  useLayoutEffect(() => {
    slot?.setSaveBar(bar);
  }, [bar, slot]);
  useLayoutEffect(() => {
    if (!slot) return;
    return () => slot.setSaveBar(null);
  }, [slot]);

  return slot ? null : <div className="sticky bottom-0">{bar}</div>;
}
