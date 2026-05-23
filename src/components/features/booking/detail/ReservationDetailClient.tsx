'use client';

import {
  ReservationDetailErrorState,
  ReservationDetailLoadingState,
} from './ReservationDetailPresentation';
import { ReservationDetailView } from './ReservationDetailView';
import {
  useReservationDetailController,
  type UseReservationDetailControllerProps,
} from './useReservationDetailController';

export type ReservationDetailClientProps = UseReservationDetailControllerProps;

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  initialNow,
  _structuredData,
  venue: providedVenue,
  canManage = false,
}: ReservationDetailClientProps) {
  const {
    actionDisabled,
    bookingDto,
    closeCancelDialog,
    closeEditDialog,
    errorDescription,
    handleAddToCalendar,
    handleCancel,
    handleDownload,
    handleEdit,
    handleRebook,
    handleShare,
    isCancelOpen,
    isEditOpen,
    isFetching,
    isInitialError,
    isInitialLoading,
    isOnline,
    refetch,
    reservation,
    reservationDisplay,
    shareFeedback,
    shareFeedbackTone,
    statusConfig,
    venue,
  } = useReservationDetailController({
    reservationId,
    restaurantName,
    initialNow,
    venue: providedVenue,
    canManage,
  });

  // Loading State
  if (isInitialLoading) {
    return <ReservationDetailLoadingState />;
  }

  // Error State
  if (isInitialError) {
    return <ReservationDetailErrorState description={errorDescription} onRetry={() => refetch()} />;
  }

  if (!reservation) return null;

  return (
    <ReservationDetailView
      actionDisabled={actionDisabled}
      bookingDto={bookingDto}
      canManage={canManage}
      closeCancelDialog={closeCancelDialog}
      closeEditDialog={closeEditDialog}
      handleAddToCalendar={handleAddToCalendar}
      handleCancel={handleCancel}
      handleDownload={handleDownload}
      handleEdit={handleEdit}
      handleRebook={handleRebook}
      handleShare={handleShare}
      isCancelOpen={isCancelOpen}
      isEditOpen={isEditOpen}
      isFetching={isFetching}
      isOnline={isOnline}
      reservation={reservation}
      reservationDisplay={reservationDisplay}
      reservationId={reservationId}
      restaurantName={restaurantName}
      shareFeedback={shareFeedback}
      shareFeedbackTone={shareFeedbackTone}
      statusConfig={statusConfig}
      venue={venue}
    />
  );
}
export default ReservationDetailClient;
