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

function looksLikeMessageId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('msg-') || lower.startsWith('msg_')) return true;
  if (looksLikeUuid(trimmed)) return true;
  return trimmed.length >= 16 && trimmed.includes('-');
}

function parsePrefixed(input: string): EmailDeliverySearchFilters | null {
  const match = /^(to|email|msg|ref)\s*:\s*(.+)$/i.exec(input);
  if (!match) return null;
  const prefix = match[1]?.toLowerCase();
  const rawValue = match[2]?.trim() ?? '';
  if (!rawValue) return {};

  switch (prefix) {
    case 'to':
    case 'email':
      return { recipientEmail: rawValue.toLowerCase() };
    case 'msg':
      return { messageId: rawValue };
    case 'ref':
      return { bookingRef: rawValue.toUpperCase() };
    default:
      return null;
  }
}

export function parseEmailDeliverySearch(input: string): EmailDeliverySearchFilters {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const prefixed = parsePrefixed(trimmed);
  if (prefixed) return prefixed;

  if (trimmed.includes('@')) {
    // Exact match, case-insensitive in API. Normalizing to lowercase makes the UI stable.
    return { recipientEmail: trimmed.toLowerCase() };
  }

  if (looksLikeMessageId(trimmed)) {
    return { messageId: trimmed };
  }

  return { bookingRef: trimmed.toUpperCase() };
}
