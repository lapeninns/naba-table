/**
 * BookingDialog
 *
 * Usage:
 * <BookingDialog
 *   booking={booking}
 *   summary={summary}
 *   allowTableAssignments
 *   onCheckIn={...}
 *   onCheckOut={...}
 *   onMarkNoShow={...}
 *   onUndoNoShow={...}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 */

'use client';

import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';

import {
  BookingDialogActionRail,
  BookingDialogBody,
  BookingDialogLayout,
  BookingDialogShell,
  BookingNoShowConfirmDialog,
  DialogHeader,
} from './components';
import { useBookingDialogController } from './hooks';

import type { BookingDialogProps } from './types';

export function BookingDialog(props: BookingDialogProps) {
  const {
    booking,
    summary,
    allowTableAssignments,
    isLoading = false,
    errorMessage = null,
    onRetry,
    onCancel,
    cancelPending,
    tableAssignmentQueryEnabled = true,
    tableAssignmentRealtime = true,
  } = props;
  const controller = useBookingDialogController(props);
  const {
    assignedTableRows,
    bookingDate,
    canCancel,
    capacityPercent,
    confirmCancel,
    confirmNoShow,
    copySummaryStatus,
    descriptionText,
    formattedDate,
    formattedStartTime,
    handleAssignmentComplete,
    handleCancel,
    handleCopyReference,
    handleCopySummary,
    handleOpenChange,
    handleTableAssignmentOpenChange,
    headerTone,
    isActionPending,
    isMobile,
    isOpen,
    isTableAssignmentOpen,
    minutesRemaining,
    needsAssignment,
    onConfirmNoShow,
    primaryAction,
    setConfirmCancel,
    setConfirmNoShow,
    shouldShowNoShow,
    srStatusMessage,
    status,
    tableAssignmentPrimaryFocusRef,
    tablePanelRef,
    timezone,
    titleText,
    totalCapacity,
  } = controller;

  const header = (
    <DialogHeader
      booking={booking}
      status={status}
      formattedDate={formattedDate}
      formattedStartTime={formattedStartTime}
      bookingDate={bookingDate}
      timezone={timezone}
      minutesRemaining={minutesRemaining}
      onClose={() => handleOpenChange(false)}
    />
  );

  const body = (
    <BookingDialogBody
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRetry={onRetry}
      booking={booking}
      summary={summary}
      isMobile={isMobile}
      allowTableAssignments={allowTableAssignments}
      needsAssignment={needsAssignment}
      bookingDate={bookingDate}
      timezone={timezone}
      status={status}
      minutesRemaining={minutesRemaining}
      assignedTableRows={assignedTableRows}
      totalCapacity={totalCapacity}
      capacityPercent={capacityPercent}
      isTableAssignmentOpen={isTableAssignmentOpen}
      onTableAssignmentOpenChange={handleTableAssignmentOpenChange}
      tablePanelRef={tablePanelRef}
      tableAssignmentPrimaryFocusRef={tableAssignmentPrimaryFocusRef}
      onAssignmentComplete={handleAssignmentComplete}
      bookingStartTime={booking?.startTime ?? null}
      bookingEndTime={booking?.endTime ?? null}
      tableAssignmentQueryEnabled={tableAssignmentQueryEnabled}
      tableAssignmentRealtime={tableAssignmentRealtime}
    />
  );

  const actionRail = (
    <BookingDialogActionRail
      booking={booking}
      canCancel={canCancel}
      copySummaryStatus={copySummaryStatus}
      formattedDate={formattedDate}
      formattedStartTime={formattedStartTime}
      isActionPending={isActionPending}
      isMobile={isMobile}
      primaryAction={primaryAction}
      shouldShowNoShow={Boolean(shouldShowNoShow)}
      srStatusMessage={srStatusMessage}
      summaryAvailable={Boolean(summary)}
      onConfirmCancel={() => setConfirmCancel(true)}
      onConfirmNoShow={() => setConfirmNoShow(true)}
      onCopyReference={handleCopyReference}
      onCopySummary={() => void handleCopySummary()}
    />
  );

  const content = (
    <BookingDialogLayout
      headerTone={headerTone}
      header={header}
      body={body}
      actionRail={actionRail}
    />
  );

  return (
    <>
      <BookingDialogShell
        isMobile={isMobile}
        open={isOpen}
        onOpenChange={handleOpenChange}
        titleText={titleText}
        descriptionText={descriptionText}
      >
        {content}
      </BookingDialogShell>

      <BookingNoShowConfirmDialog
        open={confirmNoShow}
        onOpenChange={setConfirmNoShow}
        onConfirm={onConfirmNoShow}
      />

      {onCancel ? (
        <OpsCancelBookingAlertDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          customerName={booking?.customerName ?? null}
          partySize={booking?.partySize ?? null}
          whenLabel={booking ? `${formattedDate} · ${formattedStartTime}` : null}
          onConfirm={handleCancel}
          isPending={Boolean(cancelPending)}
        />
      ) : null}
    </>
  );
}

export default BookingDialog;
