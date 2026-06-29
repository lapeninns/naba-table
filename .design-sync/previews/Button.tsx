import { Button } from 'nabatable-platform';
import { Check, Plus, Phone, X } from 'lucide-react';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Seat table</Button>
    <Button variant="secondary">Add to waitlist</Button>
    <Button variant="outline">Message guest</Button>
    <Button variant="ghost">Skip</Button>
    <Button variant="destructive">Mark no-show</Button>
    <Button variant="link">View booking</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="sm">Quick seat</Button>
    <Button size="default">Confirm party of 4</Button>
    <Button size="lg">Open floor plan</Button>
    <Button size="icon" aria-label="Add cover"><Plus /></Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button><Check /> Confirm booking</Button>
    <Button variant="outline"><Phone /> Call guest</Button>
    <Button variant="destructive"><X /> Cancel reservation</Button>
  </div>
);

export const GuestVariants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="guest-primary" size="guest-lg">Reserve a table</Button>
    <Button variant="guest-outline" size="guest-lg">Change time</Button>
    <Button variant="guest-ghost" size="guest-sm">Cancel</Button>
  </div>
);
