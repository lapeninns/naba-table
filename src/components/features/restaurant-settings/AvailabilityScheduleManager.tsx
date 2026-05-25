'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  AvailabilityScheduleErrorState,
  BookingTypesWorkspace,
  LoadingAvailabilityScheduleState,
  NoRestaurantAvailabilityScheduleState,
  ScheduleWorkspace,
} from './availability';
import {
  AvailabilityScheduleFooter,
  AvailabilityScheduleHeader,
  AvailabilitySaveAlert,
  RequiredBookingTypesAlert,
} from './AvailabilityScheduleManagerChrome';
import { SETTINGS_COMPACT_CARD_CLASS, SETTINGS_COMPACT_CARD_CONTENT_CLASS } from './shared';
import {
  useAvailabilityScheduleManagerController,
  type AvailabilityScheduleManagerWorkspace,
} from './useAvailabilityScheduleManagerController';

type AvailabilityScheduleManagerProps = {
  restaurantId: string | null;
  activeWorkspace?: AvailabilityScheduleManagerWorkspace;
};

export function AvailabilityScheduleManager({
  restaurantId,
  activeWorkspace = 'schedule',
}: AvailabilityScheduleManagerProps) {
  const controller = useAvailabilityScheduleManagerController({
    activeWorkspace,
    restaurantId,
  });

  if (controller.restaurantIdMissing) {
    return <NoRestaurantAvailabilityScheduleState />;
  }

  if (controller.loadErrorMessage) {
    return <AvailabilityScheduleErrorState message={controller.loadErrorMessage} />;
  }

  if (controller.isLoading) {
    return <LoadingAvailabilityScheduleState />;
  }

  return (
    <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')} id="availability-schedule">
      <AvailabilityScheduleHeader
        hasLocalChanges={controller.draft.hasLocalChanges}
        isScheduleWorkspace={controller.isScheduleWorkspace}
      />

      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
        <div id="availability-hours" className="scroll-mt-28" />
        <div id="service-periods" className="scroll-mt-28" />
        <AvailabilitySaveAlert saveState={controller.saveState} />

        {!controller.hasRequiredOccasions ? (
          <RequiredBookingTypesAlert
            isSaving={controller.isSaving}
            onCreateRequiredOccasions={() => void controller.createRequiredOccasions()}
          />
        ) : null}

        {controller.isScheduleWorkspace ? (
          <ScheduleWorkspace
            customRowsCount={controller.draft.customRows.length}
            dayConfigs={controller.draft.dayConfigs}
            getWeeklyDriftField={controller.getWeeklyDriftField}
            hasRequiredOccasions={controller.hasRequiredOccasions}
            occasionKeys={controller.occasionKeys}
            onAddOverride={controller.draft.addOverride}
            onMealTimeChange={controller.draft.handleMealTimeChange}
            onMealToggle={controller.draft.handleMealToggle}
            onOverrideChange={controller.draft.handleOverrideChange}
            onRemoveOverride={controller.draft.removeOverride}
            onWeeklyChange={controller.draft.handleWeeklyChange}
            operatingHoursDriftFields={controller.operatingHoursDriftFields}
            overrideErrors={controller.draft.overrideErrors}
            overrideRows={controller.draft.overrideRows}
            serviceErrors={controller.draft.serviceErrors}
            servicePeriodDriftFields={controller.servicePeriodDriftFields}
            weeklyErrors={controller.draft.weeklyErrors}
            weeklyRows={controller.draft.weeklyRows}
          />
        ) : null}

        {controller.isBookingTypesWorkspace ? (
          <BookingTypesWorkspace
            occasionDrafts={controller.draft.occasionDrafts}
            onOccasionsChange={controller.draft.handleOccasionsChange}
            onTurnBandsChange={controller.draft.handleTurnBandsChange}
            turnBandDefaults={controller.turnBandDefaults}
            turnBandErrors={controller.draft.turnBandErrors}
            turnBandsDraft={controller.draft.turnBandsDraft}
          />
        ) : null}
      </CardContent>

      <AvailabilityScheduleFooter
        canSave={controller.canSave}
        hasLocalChanges={controller.draft.hasLocalChanges}
        isSaving={controller.isSaving}
        onReset={controller.handleReset}
        onSave={controller.handleSave}
        saveState={controller.saveState}
      />
    </Card>
  );
}
