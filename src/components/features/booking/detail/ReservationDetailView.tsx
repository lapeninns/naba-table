import { AlertCircle, CheckCircle2, Clock, Info, Sparkles } from 'lucide-react';

import {
  BookingDetailShell,
  BookingSummaryCard,
  InlineAlert,
} from '@/components/features/booking/ui/BookingComponents';

import { ReservationDetailDialogs } from './ReservationDetailDialogs';
import { ReservationDetailMainContent } from './ReservationDetailMainContent';
import { ReservationDetailActionControls } from './ReservationDetailPresentation';
import { ReservationDetailSidebar } from './ReservationDetailSidebar';

import type {
  ReservationDisplay,
  ReservationStatusConfig,
  ReservationVenue,
} from './reservationDetailDomain';
import type { BookingDTO } from '@/hooks/useBookings';
import type { ShareResult } from '@/lib/reservations/share';
import type { Reservation } from '@entities/reservation/reservation.schema';

const RESERVATION_STATUS_ICONS = {
  confirmed: CheckCircle2,
  cancelled: AlertCircle,
  pending: Clock,
  checkedIn: Sparkles,
  default: Info,
} satisfies Record<ReservationStatusConfig['iconKey'], typeof CheckCircle2>;

type ReservationDetailViewProps = {
  actionDisabled: boolean;
  bookingDto: BookingDTO | null;
  canManage: boolean;
  closeCancelDialog: (open: boolean) => void;
  closeEditDialog: (open: boolean) => void;
  handleAddToCalendar: () => void;
  handleCancel: () => void;
  handleDownload: () => void;
  handleEdit: () => void;
  handleRebook: () => void;
  handleShare: () => void;
  isCancelOpen: boolean;
  isEditOpen: boolean;
  isFetching: boolean;
  isOnline: boolean;
  reservation: Reservation;
  reservationDisplay: ReservationDisplay;
  reservationId: string;
  restaurantName: string | null;
  shareFeedback: ShareResult | null;
  shareFeedbackTone: 'default' | 'success' | 'warning' | 'danger' | 'info' | null;
  statusConfig: ReservationStatusConfig;
  venue: ReservationVenue;
};

export function ReservationDetailView({
  actionDisabled,
  bookingDto,
  canManage,
  closeCancelDialog,
  closeEditDialog,
  handleAddToCalendar,
  handleCancel,
  handleDownload,
  handleEdit,
  handleRebook,
  handleShare,
  isCancelOpen,
  isEditOpen,
  isFetching,
  isOnline,
  reservation,
  reservationDisplay,
  reservationId,
  restaurantName,
  shareFeedback,
  shareFeedbackTone,
  statusConfig,
  venue,
}: ReservationDetailViewProps) {
  const StatusIcon = RESERVATION_STATUS_ICONS[statusConfig.iconKey];

  return (
    <BookingDetailShell>
      <BookingSummaryCard
        title={restaurantName ?? venue.name ?? 'Your Reservation'}
        description="Update, share, or download your booking in one place."
        reference={reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}
        status={{ icon: StatusIcon, label: statusConfig.label, tone: statusConfig.tone }}
        offlineNotice={
          !isOnline ? (
            <InlineAlert tone="warning">You’re offline — some actions may be limited.</InlineAlert>
          ) : null
        }
        actions={
          <ReservationDetailActionControls
            layout="summary"
            onDownload={handleDownload}
            onShare={handleShare}
            onAddToCalendar={handleAddToCalendar}
          />
        }
      />
      {shareFeedback ? (
        <div role="status" aria-live="polite">
          <InlineAlert tone={shareFeedbackTone ?? 'default'}>{shareFeedback.message}</InlineAlert>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <ReservationDetailMainContent
          handleAddToCalendar={handleAddToCalendar}
          handleDownload={handleDownload}
          handleShare={handleShare}
          reservation={reservation}
          reservationDisplay={reservationDisplay}
        />

        <ReservationDetailSidebar
          actionDisabled={actionDisabled}
          canManage={canManage}
          handleCancel={handleCancel}
          handleEdit={handleEdit}
          handleRebook={handleRebook}
          isFetching={isFetching}
          reservationId={reservationId}
        />
      </div>

      <ReservationDetailDialogs
        bookingDto={bookingDto}
        closeCancelDialog={closeCancelDialog}
        closeEditDialog={closeEditDialog}
        isCancelOpen={isCancelOpen}
        isEditOpen={isEditOpen}
        venue={venue}
      />
    </BookingDetailShell>
  );
}
