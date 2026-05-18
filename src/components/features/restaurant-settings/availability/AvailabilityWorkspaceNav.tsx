import { CalendarClock, ClipboardList, Clock3 } from 'lucide-react';

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
          href: '#booking-rules',
          Icon: ClipboardList,
          isActive: activeWorkspace === 'rules',
          onSelect: () => onSelectWorkspace('rules'),
        },
        {
          label: 'Schedule',
          description: 'Weekly hours, service windows, and date overrides.',
          href: '#availability-schedule',
          Icon: CalendarClock,
          isActive: activeWorkspace === 'schedule',
          badge: availabilityBadge,
          onSelect: () => onSelectWorkspace('schedule'),
        },
        {
          label: 'Booking types',
          description: 'Lunch, dinner, and turn-time rules by party size.',
          href: '#booking-occasions',
          Icon: Clock3,
          isActive: activeWorkspace === 'booking-types',
          onSelect: () => onSelectWorkspace('booking-types'),
        },
      ]}
    />
  );
}
