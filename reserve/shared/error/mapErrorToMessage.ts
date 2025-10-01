export function mapErrorToMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (error instanceof Error) {
    return error.message?.trim() || fallback;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage.trim();
    }
  }

  return fallback;
}
