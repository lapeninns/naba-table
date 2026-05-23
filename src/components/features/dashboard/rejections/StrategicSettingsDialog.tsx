'use client';

import { useCallback, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { OpsStrategicSettings } from '@/types/ops';

export function StrategicSettingsDialog({
  restaurantName,
  open,
  onOpenChange,
  settings,
  onSubmit,
  isSubmitting,
  readOnly,
}: {
  restaurantName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: OpsStrategicSettings | undefined;
  onSubmit: (weights: OpsStrategicSettings['weights']) => Promise<void>;
  isSubmitting: boolean;
  readOnly?: boolean;
}) {
  const [scarcity, setScarcity] = useState<string>('');
  const [demandMultiplier, setDemandMultiplier] = useState<string>('');
  const [futurePenalty, setFuturePenalty] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const baseline = settings?.weights ?? {
          scarcity: 22,
          demandMultiplier: null,
          futureConflictPenalty: null,
        };
        setScarcity(baseline.scarcity.toString());
        setDemandMultiplier(
          baseline.demandMultiplier === null ? '' : baseline.demandMultiplier.toString(),
        );
        setFuturePenalty(
          baseline.futureConflictPenalty === null ? '' : baseline.futureConflictPenalty.toString(),
        );
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [settings?.weights, onOpenChange],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (readOnly) {
        setError('Strategic settings are read-only. Update env values and redeploy.');
        return;
      }
      const scarcityValue = Number.parseFloat(scarcity);
      if (!Number.isFinite(scarcityValue) || scarcityValue < 0 || scarcityValue > 1000) {
        setError('Scarcity weight must be between 0 and 1000.');
        return;
      }

      const demandValue =
        demandMultiplier.trim().length === 0 ? null : Number.parseFloat(demandMultiplier);
      if (
        demandValue !== null &&
        (!Number.isFinite(demandValue) || demandValue < 0 || demandValue > 10)
      ) {
        setError('Demand multiplier override must be between 0 and 10.');
        return;
      }

      const futureValue =
        futurePenalty.trim().length === 0 ? null : Number.parseFloat(futurePenalty);
      if (
        futureValue !== null &&
        (!Number.isFinite(futureValue) || futureValue < 0 || futureValue > 100000)
      ) {
        setError('Future conflict penalty must be between 0 and 100000.');
        return;
      }

      setError(null);
      await onSubmit({
        scarcity: scarcityValue,
        demandMultiplier: demandValue,
        futureConflictPenalty: futureValue,
      });
      onOpenChange(false);
    },
    [scarcity, demandMultiplier, futurePenalty, onSubmit, onOpenChange, readOnly],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust strategic weights</DialogTitle>
          <DialogDescription>
            Tune the selector weights for {restaurantName ?? 'this restaurant'}. When settings are
            code-defined, changes require a deploy.
          </DialogDescription>
        </DialogHeader>

        {readOnly ? (
          <Alert variant="default" className="border-border/60 bg-muted/40 text-sm">
            <AlertTitle>Read-only configuration</AlertTitle>
            <AlertDescription>
              Strategic weights now live in code/env. Update deployment configuration to change
              these values.
            </AlertDescription>
          </Alert>
        ) : null}

        <FormRoot onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scarcity-weight">Scarcity weight</Label>
            <Input
              id="scarcity-weight"
              type="number"
              min={0}
              max={1000}
              step="1"
              value={scarcity}
              onChange={(event) => setScarcity(event.target.value)}
              required
              disabled={readOnly}
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              Higher scarcity increases preference for freeing rare tables.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demand-multiplier">Demand multiplier override</Label>
            <Input
              id="demand-multiplier"
              type="number"
              min={0}
              max={10}
              step="0.05"
              value={demandMultiplier}
              onChange={(event) => setDemandMultiplier(event.target.value)}
              inputMode="decimal"
              placeholder="Use fallback profile"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use demand profile rules for this restaurant.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="future-penalty">Future conflict penalty</Label>
            <Input
              id="future-penalty"
              type="number"
              min={0}
              max={100000}
              step="1"
              value={futurePenalty}
              onChange={(event) => setFuturePenalty(event.target.value)}
              inputMode="decimal"
              placeholder="Default"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Penalty applied when a placement creates conflicts with future bookings.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" className="border-border/60">
              <AlertTitle>Unable to save settings</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || readOnly}>
              {isSubmitting ? 'Saving…' : readOnly ? 'Read-only' : 'Save changes'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
