import { redirect } from 'next/navigation';

export default function OperatingHoursSettingsPage() {
  redirect('/settings/restaurant/availability#availability-hours');
}
