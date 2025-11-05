// Window utilities facade. Currently delegates to legacy exports so callers
// can depend on a stable engine path while we extract implementation.

export { computeBookingWindow as computeWindow } from '@/server/capacity/tables';
export type { BookingWindow } from '@/server/capacity/tables';

