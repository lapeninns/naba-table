'use client';

import { Utensils } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type GuestDietaryBadgeProps = {
  allergies: string[] | null | undefined;
  dietaryRestrictions: string[] | null | undefined;
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <ul className="list-disc pl-4 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuestDietaryBadge({ allergies, dietaryRestrictions }: GuestDietaryBadgeProps) {
  const allergyList = allergies?.filter(Boolean) ?? [];
  const restrictionList = dietaryRestrictions?.filter(Boolean) ?? [];

  const count = allergyList.length + restrictionList.length;
  const label = useMemo(() => `Dietary (${count})`, [count]);

  if (count === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto p-0 hover:bg-transparent">
          <Badge variant="outline" className="gap-1 border-rose-200 bg-rose-50 text-rose-800">
            <Utensils className="h-3.5 w-3.5" aria-hidden />
            {label}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">Dietary details</div>
          <div className="text-xs text-muted-foreground">
            Confirm requirements with the guest before seating.
          </div>
        </div>
        {allergyList.length > 0 ? <List title="Allergies" items={allergyList} /> : null}
        {restrictionList.length > 0 ? (
          <List title="Dietary restrictions" items={restrictionList} />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export default GuestDietaryBadge;

