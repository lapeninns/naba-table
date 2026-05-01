'use client';

import { useMemo, useState } from 'react';

import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import type { ComponentProps } from 'react';

type MenuSuggestionInputProps = Omit<ComponentProps<typeof Input>, 'onChange' | 'value'> & {
  value: string;
  suggestions: readonly string[];
  onValueChange: (value: string) => void;
  maxSuggestions?: number;
};

export function MenuSuggestionInput({
  value,
  suggestions,
  onValueChange,
  maxSuggestions = 8,
  onFocus,
  ...inputProps
}: MenuSuggestionInputProps) {
  const [open, setOpen] = useState(false);
  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const uniqueSuggestions = [...new Set(suggestions.filter(Boolean))];
    const matchingSuggestions = query
      ? uniqueSuggestions.filter((suggestion) => suggestion.toLowerCase().includes(query))
      : uniqueSuggestions;

    return matchingSuggestions.slice(0, maxSuggestions);
  }, [maxSuggestions, suggestions, value]);
  const suggestionsOpen = open && filteredSuggestions.length > 0;

  return (
    <Popover open={suggestionsOpen} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...inputProps}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={(event) => {
            setOpen(true);
            onFocus?.(event);
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup heading="Suggestions">
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={() => {
                    onValueChange(suggestion);
                    setOpen(false);
                  }}
                >
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
