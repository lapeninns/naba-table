import { CalendarClock, ClipboardList, Clock3 } from 'lucide-react';

import { AVAILABILITY_ANCHORS, availabilityHash } from '../availabilityAnchors';
import { SettingsSectionNav } from '../shared';

import type { AvailabilityWorkspace } from './types';

type AvailabilityWorkspaceNavProps = {
  activeWorkspace: AvailabilityWorkspace;
  availabilityBadge?: string;
  onSelectWorkspace: (workspace: AvailabilityWorkspace) => void;
};

export function AvailabilityWorkspaceNav({
  activeWorkspace,
  availabilityBadge,
  onSelectWorkspace,
}: AvailabilityWorkspaceNavProps) {
  return (
    <SettingsSectionNav
      title="Availability sections"
      showHeader={false}
      items={[
        {
          label: 'Booking rules',
          description: 'Reservation rhythm, default duration, seating buffer, and booking policy.',
          href: availabilityHash(AVAILABILITY_ANCHORS.bookingRules),
          Icon: ClipboardList,
          isActive: activeWorkspace === 'rules',
          onSelect: () => onSelectWorkspace('rules'),
        },
        {
          label: 'Schedule',
          description: 'Weekly hours, service windows, and date overrides.',
          href: availabilityHash(AVAILABILITY_ANCHORS.availabilitySchedule),
          Icon: CalendarClock,
          isActive: activeWorkspace === 'schedule',
          badge: availabilityBadge,
          onSelect: () => onSelectWorkspace('schedule'),
        },
        {
          label: 'Booking types',
          description: 'Lunch, dinner, and turn-time rules by party size.',
          href: availabilityHash(AVAILABILITY_ANCHORS.bookingOccasions),
          Icon: Clock3,
          isActive: activeWorkspace === 'booking-types',
          onSelect: () => onSelectWorkspace('booking-types'),
        },
      ]}
    />
  );
}
