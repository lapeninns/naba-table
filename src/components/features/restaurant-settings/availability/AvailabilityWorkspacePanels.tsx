import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

import { BookingRulesCard } from './BookingRulesCard';
import { BookingTypesCard } from './BookingTypesCard';
import { DateOverridesCard } from './DateOverridesCard';
import { ServiceWindowsCard } from './ServiceWindowsCard';
import { WeeklyScheduleCard } from './WeeklyScheduleCard';
import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';

import type { AvailabilityWorkspace } from './types';

type AvailabilityWorkspacePanelsProps = {
  activeWorkspace: AvailabilityWorkspace;
  restaurantId: string | null;
  reduceMotion: boolean | null;
};

export function AvailabilityWorkspacePanels({
  activeWorkspace,
  restaurantId,
  reduceMotion,
}: AvailabilityWorkspacePanelsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <motion.div
        hidden={activeWorkspace !== 'rules'}
        aria-hidden={activeWorkspace !== 'rules'}
        className={cn(
          'will-change-auto',
          activeWorkspace !== 'rules' && 'hidden',
          activeWorkspace === 'rules' && 'motion-safe:will-change-transform',
        )}
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: activeWorkspace === 'rules' ? 1 : 0,
                y: activeWorkspace === 'rules' ? 0 : 8,
              }
        }
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <BookingRulesCard restaurantId={restaurantId} />
      </motion.div>

      <motion.div
        hidden={activeWorkspace !== 'schedule'}
        aria-hidden={activeWorkspace !== 'schedule'}
        className={cn(
          'will-change-auto',
          activeWorkspace !== 'schedule' && 'hidden',
          activeWorkspace === 'schedule' && 'motion-safe:will-change-transform',
        )}
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: activeWorkspace === 'schedule' ? 1 : 0,
                y: activeWorkspace === 'schedule' ? 0 : 8,
              }
        }
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div
          id={AVAILABILITY_ANCHORS.availabilitySchedule}
          className="scroll-mt-28 flex flex-col gap-6"
        >
          <WeeklyScheduleCard restaurantId={restaurantId} />
          <ServiceWindowsCard restaurantId={restaurantId} />
          <DateOverridesCard restaurantId={restaurantId} />
        </div>
      </motion.div>

      <motion.div
        hidden={activeWorkspace !== 'booking-types'}
        aria-hidden={activeWorkspace !== 'booking-types'}
        className={cn(
          'will-change-auto',
          activeWorkspace !== 'booking-types' && 'hidden',
          activeWorkspace === 'booking-types' && 'motion-safe:will-change-transform',
        )}
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: activeWorkspace === 'booking-types' ? 1 : 0,
                y: activeWorkspace === 'booking-types' ? 0 : 8,
              }
        }
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <BookingTypesCard restaurantId={restaurantId} />
      </motion.div>
    </div>
  );
}
