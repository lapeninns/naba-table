import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

import { AvailabilityScheduleManager } from '../AvailabilityScheduleManager';
import { BookingRulesCard } from './BookingRulesCard';

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
        hidden={activeWorkspace === 'rules'}
        aria-hidden={activeWorkspace === 'rules'}
        className={cn(
          'will-change-auto',
          activeWorkspace === 'rules' && 'hidden',
          activeWorkspace !== 'rules' && 'motion-safe:will-change-transform',
        )}
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: activeWorkspace === 'rules' ? 0 : 1,
                y: activeWorkspace === 'rules' ? 8 : 0,
              }
        }
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <AvailabilityScheduleManager
          restaurantId={restaurantId}
          activeWorkspace={activeWorkspace === 'booking-types' ? 'booking-types' : 'schedule'}
        />
      </motion.div>
    </div>
  );
}
