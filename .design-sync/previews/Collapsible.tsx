import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
  Button, Badge,
} from 'nabatable-platform';
import { ChevronsUpDown } from 'lucide-react';

export const GuestNotes = () => (
  <Collapsible defaultOpen className="w-80 rounded-lg border p-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">Guest notes · Priya Nair</span>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle notes">
          <ChevronsUpDown />
        </Button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
      <p>Window booth requested · Anniversary</p>
      <p>Nut allergy — flag with kitchen</p>
      <div className="flex gap-2">
        <Badge variant="guest-chip">VIP</Badge>
        <Badge variant="guest-chip-outline">Regular</Badge>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

export const WaitlistGroup = () => (
  <Collapsible defaultOpen className="w-80 rounded-lg border p-3">
    <CollapsibleTrigger asChild>
      <Button variant="outline" size="sm" className="w-full justify-between">
        Waitlist · 3 parties
        <ChevronsUpDown className="size-4" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2 space-y-1 text-sm">
      <div className="flex justify-between"><span>Tom Hill · 2</span><span className="text-muted-foreground tabular-nums">~15 min</span></div>
      <div className="flex justify-between"><span>Aisha Khan · 6</span><span className="text-muted-foreground tabular-nums">~30 min</span></div>
      <div className="flex justify-between"><span>James Okoro · 3</span><span className="text-muted-foreground tabular-nums">~40 min</span></div>
    </CollapsibleContent>
  </Collapsible>
);
