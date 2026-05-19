'use client';

import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

import {
  AvailabilityWorkspaceNav,
  AvailabilityWorkspacePanels,
  type AvailabilityWorkspace,
} from './availability';
import { getGbpDriftSectionBadge, useGbpDriftSectionStatus } from './GbpDriftProvider';
import { SETTINGS_COMMAND_CENTER_LAYOUT_CLASS } from './shared';

type AvailabilityOccasionsCommandCenterProps = {
  restaurantId: string | null;
  initialWorkspace?: AvailabilityWorkspace;
};

export function AvailabilityOccasionsCommandCenter({
  restaurantId,
  initialWorkspace = 'rules',
}: AvailabilityOccasionsCommandCenterProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<AvailabilityWorkspace>(initialWorkspace);
  const reduceMotion = useReducedMotion();
  const availabilityGbpStatus = useGbpDriftSectionStatus(['operatingHours', 'servicePeriods']);
  const availabilityBadge = getGbpDriftSectionBadge(availabilityGbpStatus);

  useEffect(() => {
    setActiveWorkspace(initialWorkspace);
  }, [initialWorkspace]);

  useEffect(() => {
    const hash =
      window.location.hash.slice(1) ||
      (initialWorkspace === 'rules'
        ? 'booking-rules'
        : initialWorkspace === 'schedule'
          ? 'availability-schedule'
          : 'booking-occasions');
    const scrollToTarget = () => {
      const target = document.getElementById(hash);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return Boolean(target);
    };
    window.requestAnimationFrame(() => {
      if (!scrollToTarget()) {
        window.setTimeout(scrollToTarget, 0);
      }
    });
  }, [initialWorkspace]);

  const selectWorkspace = useCallback((workspace: AvailabilityWorkspace) => {
    setActiveWorkspace(workspace);
    const hash =
      workspace === 'rules'
        ? 'booking-rules'
        : workspace === 'schedule'
          ? 'availability-schedule'
          : 'booking-occasions';
    window.history.replaceState(null, '', `#${hash}`);
  }, []);

  return (
    <section className={SETTINGS_COMMAND_CENTER_LAYOUT_CLASS} aria-label="Availability sections">
      <AvailabilityWorkspaceNav
        activeWorkspace={activeWorkspace}
        availabilityBadge={availabilityBadge ?? undefined}
        onSelectWorkspace={selectWorkspace}
      />
      <AvailabilityWorkspacePanels
        activeWorkspace={activeWorkspace}
        restaurantId={restaurantId}
        reduceMotion={reduceMotion}
      />
    </section>
  );
}
