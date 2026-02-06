export type EmailDeliverySearchFilters = {
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
};

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseEmailDeliverySearch(input: string): EmailDeliverySearchFilters {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (trimmed.includes('@')) {
    // Exact match, case-insensitive in API. Normalizing to lowercase makes the UI stable.
    return { recipientEmail: trimmed.toLowerCase() };
  }

  if (looksLikeUuid(trimmed)) {
    return { messageId: trimmed };
  }

  return { bookingRef: trimmed.toUpperCase() };
}

