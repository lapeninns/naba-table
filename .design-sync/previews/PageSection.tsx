import { PageSection, FeatureCard } from 'nabatable-platform';
import { CalendarCheck, Users, LineChart } from 'lucide-react';

const darkBand = 'guest-theme rounded-xl';
const darkStyle = { background: '#0b1020' } as const;

export const FeatureGrid = () => (
  <div className={darkBand} style={darkStyle}>
    <PageSection
      title="Run every service with confidence"
      description="Nabatable keeps front-of-house, bookings, and covers in sync across the whole pub."
      className="!py-12"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<CalendarCheck className="size-6" aria-hidden />}
          title="Live bookings"
          description="See every reservation, walk-in, and hold update in real time."
        />
        <FeatureCard
          icon={<Users className="size-6" aria-hidden />}
          title="Cover control"
          description="Pace seatings and protect turn times across all tables."
        />
        <FeatureCard
          icon={<LineChart className="size-6" aria-hidden />}
          title="Service insight"
          description="Track no-shows, covers per hour, and revenue at a glance."
        />
      </div>
    </PageSection>
  </div>
);

export const TitledPanel = () => (
  <div className={darkBand} style={darkStyle}>
    <PageSection
      title="Tonight at The Crown & Anchor"
      description="Saturday dinner service · 84 covers booked across 21 reservations."
      className="!py-12"
    >
      <div className="grid gap-4 sm:grid-cols-3 text-primary-foreground">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-primary-foreground/70">Covers</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">84</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-primary-foreground/70">Seated</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">52</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-primary-foreground/70">No-shows</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">3</p>
        </div>
      </div>
    </PageSection>
  </div>
);

export const PlainContent = () => (
  <div className={darkBand} style={darkStyle}>
    <PageSection className="!py-12">
      <div className="grid gap-4 sm:grid-cols-2 text-primary-foreground">
        <FeatureCard
          icon={<CalendarCheck className="size-6" aria-hidden />}
          title="Reserve in seconds"
          description="Guests book a table for 2 to 10 with instant confirmation."
        />
        <FeatureCard
          icon={<Users className="size-6" aria-hidden />}
          title="Manage the floor"
          description="Hosts seat parties and clear tables from one console."
        />
      </div>
    </PageSection>
  </div>
);
