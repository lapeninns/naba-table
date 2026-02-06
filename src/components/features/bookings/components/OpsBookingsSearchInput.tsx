'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type OpsBookingsSearchInputSize = 'toolbar' | 'header';

export type OpsBookingsSearchInputProps = {
  value: string;
  onChange: (next: string) => void;
  onClear?: () => void;
  isSearching?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  size?: OpsBookingsSearchInputSize;
  className?: string;
};

const SIZE_STYLES: Record<OpsBookingsSearchInputSize, { wrapper: string; input: string }> = {
  toolbar: {
    wrapper: 'w-full md:w-60 md:flex-none',
    // Mobile: text-base (16px) prevents iOS zoom. Desktop: text-sm.
    input: 'h-11 sm:h-9 text-base sm:text-sm',
  },
  header: {
    wrapper: 'w-full sm:w-72',
    input: 'h-11 sm:h-10 text-base sm:text-sm',
  },
};

export function OpsBookingsSearchInput({
  value,
  onChange,
  onClear,
  isSearching = false,
  placeholder = 'Search by guest name or email…',
  ariaLabel = 'Search bookings',
  size = 'toolbar',
  className,
}: OpsBookingsSearchInputProps) {
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
      return;
    }
    onChange('');
  }, [onChange, onClear]);

  const styles = SIZE_STYLES[size];

  return (
    <div className={cn('relative', styles.wrapper, className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        name="bookings-search"
        autoComplete="off"
        type="search"
        className={cn(
          'w-full rounded-lg border-muted-foreground/20 bg-background pl-10 pr-11',
          styles.input,
        )}
        aria-label={ariaLabel}
        aria-busy={isSearching}
      />

      {isSearching ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching…" />
        </div>
      ) : value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
