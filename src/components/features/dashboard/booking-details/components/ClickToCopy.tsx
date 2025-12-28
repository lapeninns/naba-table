/**
 * ClickToCopy
 *
 * Copy helper with tooltip + toast feedback.
 */

'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { copyToClipboard } from '../utils';

export interface ClickToCopyProps {
  text: string;
  label: string;
  className?: string;
  compact?: boolean;
}

export function ClickToCopy({ text, label, className, compact = false }: ClickToCopyProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(text);
    setCopied(success);

    toast({
      title: success ? 'Copied' : 'Copy failed',
      description: success ? `${label} copied to clipboard` : 'Please try again.',
      variant: success ? 'default' : 'destructive',
      duration: 2000,
    });

    if (success) {
      setTimeout(() => setCopied(false), 1800);
    }
  }, [label, text, toast]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={handleCopy}
            className={cn('h-auto px-2 py-1 text-left hover:bg-muted/50 touch-manipulation', className)}
            aria-label={`Copy ${label}`}
          >
            <span className="truncate text-sm text-slate-700">{text}</span>
            {copied ? (
              <Check className="ml-2 h-3.5 w-3.5 text-emerald-500" aria-hidden />
            ) : (
              <Copy className="ml-2 h-3.5 w-3.5 text-slate-400" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? 'Copied!' : `Copy ${label}`}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
