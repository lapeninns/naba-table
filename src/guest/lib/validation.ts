export type BookingsTab = "upcoming" | "past";

export const normalizeBookingsTab = (raw?: string | null): BookingsTab => {
  if (!raw) return "upcoming";
  const value = raw.toLowerCase();
  if (value === "history" || value === "past") return "past";
  return "upcoming";
};
