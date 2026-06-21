/** Format an epoch-ms instant as HH:mm in the given timezone (24h). */
export function formatClock(ms: number, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(ms);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(ms);
  }
}
