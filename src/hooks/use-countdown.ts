import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

export function useCountdown(targetTime: DateTime | null, updateInterval = 60000) {
    const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
    const [timeStatus, setTimeStatus] = useState<'upcoming' | 'imminent' | 'started' | 'past'>('upcoming');

    useEffect(() => {
        if (!targetTime || !targetTime.isValid) {
            setMinutesRemaining(null);
            return;
        }

        const updateCountdown = () => {
            const now = DateTime.now().setZone(targetTime.zone);
            const diff = targetTime.diff(now, 'minutes').minutes;
            const rounded = Math.round(diff);

            setMinutesRemaining(rounded);

            // Update status
            if (rounded < -60) {
                setTimeStatus('past');
            } else if (rounded < 0) {
                setTimeStatus('started');
            } else if (rounded <= 15) {
                setTimeStatus('imminent');
            } else {
                setTimeStatus('upcoming');
            }
        };

        // Initial update
        updateCountdown();

        // Set up interval
        const interval = setInterval(updateCountdown, updateInterval);

        return () => clearInterval(interval);
    }, [targetTime, updateInterval]);

    return { minutesRemaining, timeStatus };
}
