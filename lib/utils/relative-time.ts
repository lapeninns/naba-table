import { DateTime } from 'luxon';

/**
 * Formats a DateTime as a relative time string (e.g., "in 2 hours", "5 minutes ago")
 */
export function formatRelativeTime(
    dateTime: DateTime | null,
    reference: DateTime,
    options: { style?: 'long' | 'short'; includeSeconds?: boolean } = {}
): string {
    if (!dateTime || !dateTime.isValid) {
        return 'Unknown';
    }

    const { style = 'long', includeSeconds = false } = options;
    const diff = dateTime.diff(reference, ['days', 'hours', 'minutes', 'seconds']);

    const absDays = Math.abs(diff.days);
    const absHours = Math.abs(diff.hours);
    const absMinutes = Math.abs(diff.minutes);
    const absSeconds = Math.abs(diff.seconds);

    const isPast = dateTime < reference;
    const suffix = isPast ? 'ago' : 'from now';

    // Days
    if (absDays >= 1) {
        const rounded = Math.round(absDays);
        return style === 'short'
            ? `${rounded}d ${isPast ? 'ago' : ''}`
            : `${rounded} day${rounded === 1 ? '' : 's'} ${suffix}`;
    }

    // Hours
    if (absHours >= 1) {
        const rounded = Math.round(absHours);
        return style === 'short'
            ? `${rounded}h ${isPast ? 'ago' : ''}`
            : `${rounded} hour${rounded === 1 ? '' : 's'} ${suffix}`;
    }

    // Minutes
    if (absMinutes >= 1) {
        const rounded = Math.round(absMinutes);
        return style === 'short'
            ? `${rounded}m ${isPast ? 'ago' : ''}`
            : `${rounded} minute${rounded === 1 ? '' : 's'} ${suffix}`;
    }

    // Seconds (only if includeSeconds is true)
    if (includeSeconds && absSeconds >= 0) {
        const rounded = Math.round(absSeconds);
        return style === 'short'
            ? `${rounded}s ${isPast ? 'ago' : ''}`
            : `${rounded} second${rounded === 1 ? '' : 's'} ${suffix}`;
    }

    return 'Just now';
}

/**
 * Formats a countdown as "Xh Ym" or "Xm" for display
 */
export function formatCountdown(minutes: number): string {
    if (minutes < 0) {
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;

        if (hours > 0) {
            return `Started ${hours}h ${mins}m ago`;
        }
        return `Started ${mins}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    return `${mins}m`;
}
