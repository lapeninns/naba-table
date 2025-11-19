'use client';

import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type CopyButtonProps = {
    text: string;
    label?: string;
    className?: string;
    size?: 'sm' | 'default' | 'lg' | 'icon';
    variant?: 'default' | 'ghost' | 'outline';
    showToast?: boolean;
};

export function CopyButton({
    text,
    label,
    className,
    size = 'icon',
    variant = 'ghost',
    showToast = true
}: CopyButtonProps) {
    const { copy, status } = useCopyToClipboard();
    const { toast } = useToast();

    const handleCopy = async () => {
        const success = await copy(text);

        if (success && showToast) {
            toast({
                title: 'Copied!',
                description: label ? `${label} copied to clipboard` : 'Copied to clipboard',
                duration: 2000,
            });
        } else if (!success && showToast) {
            toast({
                title: 'Failed to copy',
                description: 'Please try again',
                variant: 'destructive',
                duration: 2000,
            });
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleCopy}
            className={cn(
                'transition-all',
                status === 'copied' && 'text-green-600',
                className
            )}
            aria-label={`Copy ${label || 'text'}`}
        >
            {status === 'copied' ? (
                <Check className="h-4 w-4" aria-hidden />
            ) : (
                <Copy className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">
                {status === 'copied' ? 'Copied!' : `Copy ${label || 'text'}`}
            </span>
        </Button>
    );
}
