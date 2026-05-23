import { UtensilsCrossed } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { AvailabilityOccasionsEditor } from '../AvailabilityOccasionsEditor';

import type { TurnBandRowError } from '../turnBandsDomain';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type BookingTypesWorkspaceProps = {
  occasionDrafts: OpsOccasion[];
  onOccasionsChange: (next: OpsOccasion[]) => void;
  turnBandsDraft: TurnBandsPayload;
  turnBandDefaults: Record<string, TurnBandInput[]>;
  turnBandErrors: Record<string, TurnBandRowError[]>;
  onTurnBandsChange: (optionKey: string, nextBands: TurnBandInput[]) => void;
};

export function BookingTypesWorkspace({
  occasionDrafts,
  onOccasionsChange,
  turnBandsDraft,
  turnBandDefaults,
  turnBandErrors,
  onTurnBandsChange,
}: BookingTypesWorkspaceProps) {
  return (
    <>
      <Alert>
        <UtensilsCrossed className="size-4" />
        <AlertTitle>Booking types control guest choices</AlertTitle>
        <AlertDescription>
          Keep lunch and dinner active, then tune duration and turn-time rules so the booking grid
          matches how service actually runs. Booking slot spacing lives under{' '}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => {
              window.history.replaceState(null, '', '#booking-rules');
              document
                .getElementById('booking-rules')
                ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }}
          >
            Booking rules
          </Button>
          .
        </AlertDescription>
      </Alert>

      <div id="booking-occasions" className="flex scroll-mt-28 flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Booking types</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Name the guest choices that appear in the booking flow.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Turn times by party size</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Set how long each party-size band blocks tables for each booking type.
          </p>
        </div>
        <AvailabilityOccasionsEditor
          occasions={occasionDrafts}
          onChange={onOccasionsChange}
          turnBands={turnBandsDraft}
          turnBandDefaults={turnBandDefaults}
          turnBandErrors={turnBandErrors}
          onTurnBandsChange={onTurnBandsChange}
        />
      </div>
    </>
  );
}
