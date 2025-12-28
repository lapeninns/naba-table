# Component Architecture & Specifications

## Visual Component Tree

```
BookingDetailsDialogV4
├── Dialog (shadcn)
│   └── DialogContent (custom styled)
│       ├── IdentityStrip (header)
│       │   ├── Avatar (shadcn)
│       │   ├── NameBlock
│       │   │   ├── H2: Customer Name
│       │   │   └── Subtitle: ID + Date
│       │   ├── BookingStatusBadge (existing)
│       │   └── HeaderActions
│       │       ├── Button: Activity
│       │       ├── Button: Keys
│       │       └── Button: Close
│       │
│       ├── ContentGrid (flex with sidebar + main)
│       │   ├── GuestContextSidebar (left, 280-300px)
│       │   │   ├── ProfileInsightsSection
│       │   │   │   ├── LoyaltyBadge (conditional)
│       │   │   │   └── ContactCards
│       │   │   │       ├── InfoCard (phone)
│       │   │   │       └── InfoCard (email)
│       │   │   ├── PreferencesSection
│       │   │   │   └── PreferencePills (chips)
│       │   │   └── NotesSection
│       │   │       ├── NoteCard (reservation)
│       │   │       └── NoteCard (profile)
│       │   │
│       │   └── OperationalZone (right, flex-1)
│       │       ├── MetricsRow (grid 3-col)
│       │       │   ├── MetricCard (Party Size)
│       │       │   ├── MetricCard (Arrival Time)
│       │       │   └── MetricCard (Table Allocation)
│       │       │
│       │       └── TableAllocationArea
│       │           ├── AllocationHeader
│       │           │   └── CapacityIndicator
│       │           └── TableGrid (embedded BookingAssignmentTabContent)
│       │
│       └── FloatingActionDock (absolute bottom center)
│           ├── BookingActionButton (primary)
│           ├── Separator
│           ├── Button: No Show (icon)
│           └── CountdownPill (conditional)
│
├── BookingHistoryDialog (sub-dialog)
└── KeyboardShortcutsDialog (sub-dialog)
```

---

## Detailed Component Specifications

### 1. IdentityStrip

**File**: `components/IdentityStrip.tsx`
**Purpose**: Display guest identity, booking status, and header actions

```tsx
interface IdentityStripProps {
  customerName: string;
  initials: string;
  bookingId: string;
  status: OpsBookingStatus;
  serviceDate: string; // Pre-formatted compact date string
  onOpenHistory: () => void;
  onOpenShortcuts: () => void;
  onClose: () => void;
}
```

**Visual Breakdown**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Avatar     ]   [Name: John Smith         ] [STATUS]   [●][?][X]        │
│  [   64px    ]   [ID: ABC123 · Dec 28, 2024]                             │
└──────────────────────────────────────────────────────────────────────────┘
    ▲               ▲                            ▲         ▲
    │               │                            │         │
    ring-4          text-3xl bold                badge     header buttons
    shadow-sm       text-xs mono slate-400                 rounded-full
```

**Shadcn Components Used**:

- `Avatar`, `AvatarFallback`
- `Button` (ghost, icon variants)
- `Separator`

**CSS Classes**:

```css
.identity-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 40px;
  border-bottom: 1px solid var(--border);
  background-color: var(--white);
}
```

---

### 2. GuestContextSidebar

**File**: `components/GuestContextSidebar.tsx`
**Purpose**: Display guest profile, preferences, and notes in a sidebar

```tsx
interface GuestContextSidebarProps {
  booking: Pick<
    OpsTodayBooking,
    | 'customerName'
    | 'customerEmail'
    | 'customerPhone'
    | 'loyaltyTier'
    | 'seatingPreference'
    | 'dietaryRestrictions'
    | 'allergies'
    | 'notes'
    | 'profileNotes'
  >;
}
```

**Section Structure**:

```
┌─────────────────────────────────────┐
│  🛡 PROFILE INSIGHTS                │  <- Section Header
│  ┌─────────────────────────────────┐│
│  │ Tier    [Gold Member]           ││  <- White Card
│  │ ⭐ Gold Member · Frequent Diner ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 📱 +1 555-123-4567              ││  <- InfoCard
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ ✉️ john@example.com             ││  <- InfoCard
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  ⚙️ GUEST PREFERENCES               │
│  [📍 Window Seat] [🥗 Vegetarian]   │  <- Pill Chips
│  [⚠️ Peanut Allergy]                │
├─────────────────────────────────────┤
│  📝 OPERATIONAL NOTES               │
│  ┌─────────────────────────────────┐│
│  │ ▐ "Birthday celebration..."     ││  <- Note Card (blue accent)
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ ▐ "VIP regular, prefers..."     ││  <- Note Card (amber accent)
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Shadcn Components Used**:

- `ScrollArea` (for overflow)
- `Badge`
- `Card`

---

### 3. InfoCard (Refactored DetailCard)

**File**: `components/InfoCard.tsx`
**Purpose**: Reusable card for displaying labeled information

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const infoCardVariants = cva(
  'flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] transition-all',
  {
    variants: {
      variant: {
        compact: 'p-3 bg-[var(--white)] shadow-sm',
        standard: 'p-4 bg-[var(--white)] shadow-md',
        link: 'p-3 bg-[var(--white)] shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer group',
        metric: 'p-5 bg-[var(--slate-50)]/50 hover:bg-white hover:shadow-md',
      },
    },
    defaultVariants: {
      variant: 'compact',
    },
  },
);

interface InfoCardProps extends VariantProps<typeof infoCardVariants> {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  href?: string;
  copyable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function InfoCard({
  variant,
  icon: Icon,
  label,
  value,
  subValue,
  href,
  copyable,
  onClick,
  className,
}: InfoCardProps) {
  const Wrapper = href ? 'a' : onClick ? 'button' : 'div';
  const wrapperProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { onClick };

  return (
    <Wrapper className={cn(infoCardVariants({ variant }), className)} {...wrapperProps}>
      <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--brand-blue-subtle)] text-[var(--brand-blue)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[var(--slate-400)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-base font-bold text-[var(--slate-900)] truncate">{value}</p>
        {subValue && <p className="text-xs text-[var(--slate-500)]">{subValue}</p>}
      </div>
      {copyable && <CopyButton text={String(value)} />}
    </Wrapper>
  );
}
```

---

### 4. MetricCard (New Component)

**File**: `components/MetricCard.tsx`
**Purpose**: Display key operational metrics with visual emphasis

```tsx
interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string; // Tailwind color class
  label: string;
  value: string | number;
  unit?: string; // e.g., "covers", "seats"
  className?: string;
}

export function MetricCard({
  icon: Icon,
  iconColor = 'text-[var(--slate-400)]',
  label,
  value,
  unit,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-5 p-5',
        'bg-[var(--slate-50)]/50 rounded-[var(--radius-xl)]',
        'border border-[var(--border)]',
        'transition-all hover:bg-white hover:shadow-md hover:border-[var(--brand-blue-subtle)]',
        className,
      )}
    >
      <div
        className={cn(
          'h-12 w-12 flex items-center justify-center',
          'bg-white rounded-2xl shadow-sm',
          iconColor,
          'group-hover:text-[var(--brand-blue)] transition-colors',
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--slate-400)] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[var(--slate-900)] tabular-nums">{value}</span>
          {unit && <span className="text-xs font-medium text-[var(--slate-500)]">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
```

---

### 5. FloatingActionDock

**File**: `components/FloatingActionDock.tsx`
**Purpose**: Always-visible action bar for primary booking operations

```tsx
interface FloatingActionDockProps {
  booking: OpsTodayBooking;
  pendingAction: BookingAction | null;
  onCheckIn: () => Promise<void>;
  onCheckOut: () => Promise<void>;
  onMarkNoShow: (opts?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (reason?: string | null) => Promise<void>;
  countdown?: {
    minutesRemaining: number | null;
    timeStatus: TimeStatus;
  };
  sidebarWidth?: number; // To offset left positioning
}

export function FloatingActionDock({
  booking,
  pendingAction,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  countdown,
  sidebarWidth = 300,
}: FloatingActionDockProps) {
  const showCountdown =
    countdown?.minutesRemaining !== null &&
    countdown.timeStatus !== 'past' &&
    countdown.minutesRemaining <= 60;

  return (
    <div
      className="absolute bottom-10 right-0 flex justify-center z-50 pointer-events-none px-10"
      style={{ left: sidebarWidth }}
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-4 p-3',
          'bg-white/95 backdrop-blur-xl',
          'border border-[var(--slate-200)]',
          'shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]',
          'rounded-full ring-1 ring-black/5',
          'animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out',
        )}
      >
        {/* Primary Action */}
        <div className="flex items-center pl-2">
          <BookingActionButton
            booking={booking}
            pendingAction={pendingAction}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            onMarkNoShow={onMarkNoShow}
            onUndoNoShow={onUndoNoShow}
            showConfirmation
            className="rounded-full shadow-lg min-w-[160px] h-12 text-sm font-bold"
          />
        </div>

        <Separator orientation="vertical" className="h-10" />

        {/* Secondary: No Show */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-12 w-12 text-slate-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => onMarkNoShow()}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark No Show</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Countdown Timer */}
        {showCountdown && (
          <div className="hidden sm:flex items-center px-5 py-2.5 bg-[var(--slate-950)] text-white rounded-full shadow-lg">
            <div className="relative flex h-2 w-2 mr-3">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  countdown.timeStatus === 'imminent' ? 'bg-amber-400' : 'bg-blue-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  countdown.timeStatus === 'imminent' ? 'bg-amber-500' : 'bg-blue-500',
                )}
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">
              Arriving in {formatCountdown(countdown.minutesRemaining!)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 6. NoteCard (New Component)

**File**: `components/NoteCard.tsx`
**Purpose**: Display reservation or profile notes with visual distinction

```tsx
type NoteCardVariant = 'reservation' | 'profile' | 'warning';

const accentColors: Record<NoteCardVariant, string> = {
  reservation: 'border-l-blue-500',
  profile: 'border-l-amber-500',
  warning: 'border-l-red-500',
};

const labelColors: Record<NoteCardVariant, string> = {
  reservation: 'text-blue-500',
  profile: 'text-amber-500',
  warning: 'text-red-500',
};

interface NoteCardProps {
  variant: NoteCardVariant;
  label: string;
  content: string;
  className?: string;
}

export function NoteCard({ variant, label, content, className }: NoteCardProps) {
  return (
    <div
      className={cn(
        'p-4 bg-white rounded-[var(--radius-lg)] shadow-sm',
        'border-l-4',
        accentColors[variant],
        className,
      )}
    >
      <p className={cn('text-[10px] font-bold uppercase mb-2', labelColors[variant])}>{label}</p>
      <p className="text-xs leading-relaxed text-[var(--slate-700)] font-medium italic">
        &ldquo;{content}&rdquo;
      </p>
    </div>
  );
}
```

---

### 7. PreferencePill (New Component)

**File**: `components/PreferencePill.tsx`
**Purpose**: Display guest preferences as color-coded chips

```tsx
type PreferencePillVariant = 'seating' | 'dietary' | 'allergy';

const pillStyles: Record<PreferencePillVariant, string> = {
  seating: 'bg-emerald-50/50 text-emerald-700 border-emerald-100',
  dietary: 'bg-amber-50/50 text-amber-700 border-amber-100',
  allergy: 'bg-red-50/50 text-red-700 border-red-100',
};

const pillIcons: Record<PreferencePillVariant, LucideIcon> = {
  seating: MapPin,
  dietary: Utensils,
  allergy: AlertTriangle,
};

interface PreferencePillProps {
  variant: PreferencePillVariant;
  label: string;
  className?: string;
}

export function PreferencePill({ variant, label, className }: PreferencePillProps) {
  const Icon = pillIcons[variant];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5',
        'border rounded-full text-[11px] font-bold',
        pillStyles[variant],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}
```

---

## File Structure After Refactor

```
src/components/features/dashboard/booking-details/
├── BookingDetailsDialogV4.tsx          # New main dialog
├── BookingDetailsDialogV2.tsx          # Legacy (fallback)
├── BookingAssignmentTabContent.tsx     # Table assignment (adapted)
├── components/
│   ├── index.ts
│   ├── IdentityStrip.tsx               # NEW
│   ├── GuestContextSidebar.tsx         # NEW (replaces GuestProfilePanel)
│   ├── InfoCard.tsx                    # Refactored DetailCard
│   ├── MetricCard.tsx                  # NEW
│   ├── FloatingActionDock.tsx          # NEW
│   ├── NoteCard.tsx                    # NEW
│   ├── PreferencePill.tsx              # NEW
│   ├── BookingHistoryDialog.tsx        # Existing
│   ├── KeyboardShortcutsDialog.tsx     # Existing
│   └── ShortcutHint.tsx                # Existing
├── hooks/
│   ├── index.ts
│   ├── useBookingDialogState.ts
│   ├── useBookingCountdown.ts
│   └── useKeyboardShortcuts.ts
├── constants.ts
├── types.ts                            # Updated with new types
└── restaurantDialogTheme.ts
```

---

_Specification created: December 28, 2024_
