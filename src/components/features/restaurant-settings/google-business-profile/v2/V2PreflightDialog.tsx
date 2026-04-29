/**
 * Phase 5 of the GBP Dual-Sync V2 architecture.
 *
 * Preflight + password confirmation dialog. Renders the preflight result
 * (planned items + masks) and gates publish on operator password entry.
 */

'use client';

import { AlertTriangle, CheckCircle2, LockKeyhole, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import type {
  SyncV2DecisionAction,
  SyncV2PreflightResult,
  SyncV2PublishJob,
  SyncV2SectionKey,
} from '@/server/google-business-profile-v2/types';

export interface V2PreflightDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly preflight: SyncV2PreflightResult | null;
  readonly publishJob: SyncV2PublishJob | null;
  readonly preflightErrors: SyncV2PreflightResult['errors'];
  readonly isPublishing: boolean;
  readonly onConfirm: (publishJobId: string, confirmPassword: string) => Promise<void>;
}

const SECTION_LABELS: Record<SyncV2SectionKey, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
};

function sentenceCase(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return 'Field';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function fieldLabel(fieldKey: string): string {
  const known: Record<string, string> = {
    address: 'Address',
    contactPhone: 'Contact phone',
    googleMapUrl: 'Google Maps link',
    googleReviewUrl: 'Google review link',
    name: 'Business name',
  };
  if (fieldKey.includes('|')) {
    const [, startTime, endTime, name] = fieldKey.split('|');
    const readableName = name ? sentenceCase(name) : null;
    const readableTime = startTime && endTime ? `${startTime} to ${endTime}` : null;
    if (readableName && readableTime) return `${readableName}: ${readableTime}`;
    if (readableName) return readableName;
  }
  return known[fieldKey] ?? sentenceCase(fieldKey);
}

function directionLabel(direction: SyncV2PreflightResult['directionIntent']): string {
  return direction === 'import_to_nabatable'
    ? 'Import Google values into Nabatable'
    : 'Export Nabatable values to Google';
}

function actionLabel(action: SyncV2DecisionAction): string {
  if (action === 'import_from_google') return 'Import';
  if (action === 'export_to_google') return 'Export';
  return 'Ignore';
}

export function V2PreflightDialog({
  open,
  onOpenChange,
  preflight,
  publishJob,
  preflightErrors,
  isPublishing,
  onConfirm,
}: V2PreflightDialogProps) {
  const [password, setPassword] = useState('');

  const blocked = preflightErrors && preflightErrors.length > 0;
  const canSubmit =
    !blocked && !!publishJob && !!preflight && password.trim().length > 0 && !isPublishing;

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Final sync check</DialogTitle>
            {preflight ? (
              <Badge variant="outline">{directionLabel(preflight.directionIntent)}</Badge>
            ) : null}
          </div>
          <DialogDescription>
            Confirm the reviewed changes before Nabatable publishes them to the selected system.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {blocked ? (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="size-4" />
              <AlertTitle>Final check blocked</AlertTitle>
              <AlertDescription>
                <div className="mt-3 flex flex-col gap-2">
                  {preflightErrors.map((error) => (
                    <div
                      key={`${error.code}-${error.sectionKey ?? ''}-${error.fieldKey ?? ''}-${error.message}`}
                      className="rounded-md bg-background/70 px-3 py-2 text-sm text-foreground"
                    >
                      <p className="font-medium">
                        {error.sectionKey ? SECTION_LABELS[error.sectionKey] : 'Sync issue'}
                        {error.fieldKey ? ` · ${fieldLabel(error.fieldKey)}` : null}
                      </p>
                      <p className="text-muted-foreground">{error.message}</p>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : preflight ? (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/30 p-4 ring-1 ring-border/70">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Direction
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {directionLabel(preflight.directionIntent)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4 ring-1 ring-border/70">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Ready to publish
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {preflight.publishablePlanItems.length} field
                    {preflight.publishablePlanItems.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4 ring-1 ring-border/70">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Google fields
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {preflight.googleUpdateMasks.length > 0
                      ? preflight.googleUpdateMasks.map(sentenceCase).join(', ')
                      : 'No Google patch'}
                  </p>
                </div>
              </div>

              {preflight.warnings.length > 0 ? (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Review warnings</AlertTitle>
                  <AlertDescription className="flex flex-col gap-1">
                    {preflight.warnings.map((warning) => (
                      <span key={`${warning.code}-${warning.fieldKey ?? warning.message}`}>
                        {warning.message}
                      </span>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertTitle>Preflight passed</AlertTitle>
                  <AlertDescription>
                    The server froze this publish plan. Enter your password to apply it.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border bg-background">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Planned changes</p>
                    <p className="text-xs text-muted-foreground">
                      These are the exact field decisions that will be published.
                    </p>
                  </div>
                  <Badge variant="secondary">{preflight.publishablePlanItems.length}</Badge>
                </div>
                <div className="max-h-64 overflow-auto">
                  {preflight.publishablePlanItems.length > 0 ? (
                    preflight.publishablePlanItems.map((item) => (
                      <div
                        key={`${item.sectionKey}::${item.fieldKey}`}
                        className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{fieldLabel(item.fieldKey)}</p>
                          <p className="text-xs text-muted-foreground">
                            {SECTION_LABELS[item.sectionKey]}
                          </p>
                        </div>
                        <Badge variant="outline">{actionLabel(item.action)}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      No publishable changes were returned by preflight.
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label htmlFor="v2-confirm-password" className="flex items-center gap-2">
                  <LockKeyhole className="size-4" aria-hidden />
                  Confirm with your password
                </Label>
                <Input
                  id="v2-confirm-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPublishing}
                  autoComplete="current-password"
                  placeholder="Enter your operator password"
                />
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTitle>No preflight result available</AlertTitle>
              <AlertDescription>
                Run preflight again to prepare a publishable plan.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Close
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={async () => {
              if (!publishJob) return;
              await onConfirm(publishJob.id, password);
            }}
          >
            <Send data-icon="inline-start" />
            {isPublishing ? 'Publishing' : 'Publish changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
