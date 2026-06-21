'use client';

import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
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
  showToast = true,
}: CopyButtonProps) {
  const { copy, status } = useCopyToClipboard();
  const handleCopy = async () => {
    const success = await copy(text);

    if (!success || !showToast) {
      return;
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn('transition-all', status === 'copied' && 'text-primary', className)}
      aria-label={`Copy ${label || 'text'}`}
    >
      {status === 'copied' ? (
        <Check data-icon="inline-start" aria-hidden />
      ) : (
        <Copy data-icon="inline-start" aria-hidden />
      )}
      <span className="sr-only">{status === 'copied' ? 'Copied!' : `Copy ${label || 'text'}`}</span>
    </Button>
  );
}
