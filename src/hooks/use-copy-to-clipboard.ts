import { useCallback, useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'error';

export function useCopyToClipboard(resetDelay = 2000) {
    const [status, setStatus] = useState<CopyStatus>('idle');

    const copy = useCallback(
        async (text: string) => {
            if (!navigator?.clipboard) {
                console.warn('Clipboard API not available');
                setStatus('error');
                return false;
            }

            try {
                await navigator.clipboard.writeText(text);
                setStatus('copied');

                // Reset after delay
                setTimeout(() => {
                    setStatus('idle');
                }, resetDelay);

                return true;
            } catch (error) {
                console.error('Failed to copy:', error);
                setStatus('error');

                setTimeout(() => {
                    setStatus('idle');
                }, resetDelay);

                return false;
            }
        },
        [resetDelay]
    );

    return { copy, status };
}
