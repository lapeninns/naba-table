import { Calendar, Clock, Mail, MessageSquare, Phone, User, Users } from 'lucide-react';

import { DetailStatCard, InfoPanel } from '@/components/features/booking/ui/BookingComponents';

import { ReservationDetailActionControls } from './ReservationDetailPresentation';

import type { ReservationDisplay } from './reservationDetailDomain';
import type { Reservation } from '@entities/reservation/reservation.schema';

type ReservationDetailMainContentProps = {
  handleAddToCalendar: () => void;
  handleDownload: () => void;
  handleShare: () => void;
  reservation: Reservation;
  reservationDisplay: ReservationDisplay;
};

export function ReservationDetailMainContent({
  handleAddToCalendar,
  handleDownload,
  handleShare,
  reservation,
  reservationDisplay,
}: ReservationDetailMainContentProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <DetailStatCard
          icon={Calendar}
          label="Date"
          value={reservationDisplay.shortDate}
          subtext={reservationDisplay.fullDate}
        />
        <DetailStatCard
          icon={Clock}
          label="Time"
          value={reservationDisplay.time}
          subtext="Local time"
        />
        <DetailStatCard
          icon={Users}
          label="Party Size"
          value={`${reservation.partySize}`}
          subtext={reservation.partySize === 1 ? 'Guest' : 'Guests'}
        />
      </div>

      <InfoPanel
        title="Guest Information"
        rows={[
          { icon: User, label: 'Primary Guest', value: reservation.customerName },
          { icon: Mail, label: 'Email', value: reservation.customerEmail },
          { icon: Phone, label: 'Phone', value: reservation.customerPhone },
        ]}
      />

      {reservation.notes ? (
        <InfoPanel
          title="Preferences"
          rows={[{ icon: MessageSquare, label: 'Special Requests', value: reservation.notes }]}
        />
      ) : null}

      <ReservationDetailActionControls
        layout="mobile"
        onDownload={handleDownload}
        onShare={handleShare}
        onAddToCalendar={handleAddToCalendar}
      />
    </div>
  );
}
