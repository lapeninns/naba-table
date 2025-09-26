import BookingFlowPage from '@/components/reserve/booking-flow';
import ReserveApp from '@app/index';

const isReserveV2Enabled = process.env.NEXT_PUBLIC_RESERVE_V2 === 'true';

export default function ReserveEntryPage() {
  if (!isReserveV2Enabled) {
    return <BookingFlowPage />;
  }

  return <ReserveApp />;
}
