import { CopyButton } from 'nabatable-platform';

export const BookingReference = () => (
  <div className="flex items-center gap-2 rounded-lg border p-4 w-80">
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">Booking reference</span>
      <span className="font-semibold tabular-nums tracking-wide">NBT-4827-PH</span>
    </div>
    <CopyButton text="NBT-4827-PH" label="booking reference" className="ml-auto" />
  </div>
);

export const GuestPhone = () => (
  <div className="flex items-center gap-2 rounded-lg border p-4 w-80">
    <div className="flex flex-col">
      <span className="text-sm font-medium">Priya Nair</span>
      <span className="text-sm text-muted-foreground tabular-nums">07700 900123</span>
    </div>
    <CopyButton text="07700 900123" label="phone number" className="ml-auto" />
  </div>
);

export const ShareLink = () => (
  <div className="flex items-center gap-2 rounded-lg border p-4 w-80">
    <span className="truncate text-sm text-muted-foreground">
      nabatable.co.uk/r/the-crown/sat-8pm
    </span>
    <CopyButton
      text="https://nabatable.co.uk/r/the-crown/sat-8pm"
      label="share link"
      size="sm"
      variant="outline"
      className="ml-auto"
    />
  </div>
);

export const WithLabel = () => (
  <div className="flex items-center gap-3 w-72">
    <CopyButton
      text="Table 12 · Sat 8:00 PM · Party of 4"
      label="booking details"
      size="default"
      variant="default"
    />
    <span className="text-sm text-muted-foreground">Copy booking details</span>
  </div>
);
