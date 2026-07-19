'use client';

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ScenarioKey = 'weekday' | 'sunday' | 'selected';

type PrototypeScenario = {
  date: string;
  time: string;
  party: number;
  roastSelected: boolean;
};

const SCENARIOS: Record<ScenarioKey, PrototypeScenario> = {
  weekday: {
    date: '2026-07-27',
    time: '18:30',
    party: 4,
    roastSelected: false,
  },
  sunday: {
    date: '2026-07-26',
    time: '13:00',
    party: 4,
    roastSelected: false,
  },
  selected: {
    date: '2026-07-26',
    time: '13:00',
    party: 4,
    roastSelected: true,
  },
};

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIME_OPTIONS = ['12:00', '12:30', '13:00', '13:30', '14:00', '15:30', '16:30', '18:30'];
const ROAST_WINDOW_START = '12:00';
const ROAST_WINDOW_END = '17:00';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSunday(value: string): boolean {
  return parseDateOnly(value)?.getUTCDay() === 0;
}

function isRoastTime(value: string): boolean {
  return value >= ROAST_WINDOW_START && value < ROAST_WINDOW_END;
}

function formatDate(value: string): string {
  const date = parseDateOnly(value);
  return date ? DATE_FORMATTER.format(date) : 'Choose a date';
}

function formatTime(value: string): string {
  const time = new Date(`1970-01-01T${value}:00Z`);
  return Number.isNaN(time.getTime()) ? value : TIME_FORMATTER.format(time);
}

export function GuestBookingSundayRoastDevHarness() {
  const initialScenario = SCENARIOS.sunday;
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey | null>('sunday');
  const [date, setDate] = useState(initialScenario.date);
  const [time, setTime] = useState(initialScenario.time);
  const [party, setParty] = useState(initialScenario.party);
  const [roastSelected, setRoastSelected] = useState(initialScenario.roastSelected);

  const sundaySelected = isSunday(date);
  const roastTimeSelected = isRoastTime(time);
  const canSelectRoast = sundaySelected && roastTimeSelected;
  const serviceLabel = time < '17:00' ? 'Lunch' : 'Dinner';

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const chooseScenario = (key: ScenarioKey) => {
    const scenario = SCENARIOS[key];
    setActiveScenario(key);
    setDate(scenario.date);
    setTime(scenario.time);
    setParty(scenario.party);
    setRoastSelected(scenario.roastSelected);
  };

  const changeDate = (nextDate: string) => {
    setActiveScenario(null);
    setDate(nextDate);
    setRoastSelected((selected) => selected && isSunday(nextDate) && roastTimeSelected);
  };

  const changeTime = (nextTime: string) => {
    setActiveScenario(null);
    setTime(nextTime);
    setRoastSelected((selected) => selected && sundaySelected && isRoastTime(nextTime));
  };

  const changeParty = (nextParty: string) => {
    setActiveScenario(null);
    setParty(Number(nextParty));
  };

  return (
    <main
      className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"
      data-testid="sunday-roast-harness"
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="guest-chip-outline">Dev harness</Badge>
              <Badge variant="guest-chip">Booking-level selection</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sunday roast booking prototype
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Explore when the option appears, how a guest selects it, and the signal staff receive.
            </p>
          </div>

          <ToggleGroup
            type="single"
            value={activeScenario ?? ''}
            onValueChange={(value) => {
              if (value) chooseScenario(value as ScenarioKey);
            }}
            variant="outline"
            aria-label="Prototype scenario"
            className="justify-start sm:justify-end"
          >
            <ToggleGroupItem value="weekday">Weekday</ToggleGroupItem>
            <ToggleGroupItem value="sunday">Sunday</ToggleGroupItem>
            <ToggleGroupItem value="selected">Selected</ToggleGroupItem>
          </ToggleGroup>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]">
          <Card variant="compact" className="overflow-hidden">
            <CardHeader className="gap-3 border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="guest-chip-outline">Step 1 of 3</Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  The Old Crown Girton
                </span>
              </div>
              <CardTitle className="text-2xl">Plan your table</CardTitle>
              <CardDescription>
                Choose the party size, date, and time before we ask for contact details.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 pt-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prototype-party">
                    <Users className="size-4" aria-hidden />
                    Party size
                  </Label>
                  <Select value={String(party)} onValueChange={changeParty}>
                    <SelectTrigger id="prototype-party" aria-label="Party size">
                      <SelectValue>
                        {party} {party === 1 ? 'guest' : 'guests'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {PARTY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option} {option === 1 ? 'guest' : 'guests'}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="prototype-date">
                    <CalendarDays className="size-4" aria-hidden />
                    Date
                  </Label>
                  <Input
                    id="prototype-date"
                    type="date"
                    value={date}
                    onChange={(event) => changeDate(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="prototype-time">
                    <Clock3 className="size-4" aria-hidden />
                    Time
                  </Label>
                  <Select value={time} onValueChange={changeTime}>
                    <SelectTrigger id="prototype-time" aria-label="Time">
                      <SelectValue>{formatTime(time)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatTime(option)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {sundaySelected ? (
                <div className="flex flex-col gap-3" aria-live="polite">
                  <Card variant="compact">
                    <CardHeader className="flex-row items-start gap-4">
                      <Checkbox
                        id="sunday-roast-selection"
                        checked={roastSelected}
                        disabled={!roastTimeSelected}
                        onClick={() => {
                          setActiveScenario(null);
                          setRoastSelected((selected) => !selected && canSelectRoast);
                        }}
                        aria-describedby="sunday-roast-description sunday-roast-availability"
                        className="mt-1 size-5"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label
                            htmlFor="sunday-roast-selection"
                            className="cursor-pointer text-base font-semibold"
                          >
                            <UtensilsCrossed className="size-4" aria-hidden />
                            This booking is for Sunday roast
                          </Label>
                          <Badge variant={roastTimeSelected ? 'guest-chip' : 'outline'}>
                            {roastTimeSelected ? 'Available' : 'Outside serving hours'}
                          </Badge>
                        </div>
                        <CardDescription id="sunday-roast-description">
                          Let the team know so they can prepare for your visit.
                        </CardDescription>
                        <p id="sunday-roast-availability" className="text-xs text-muted-foreground">
                          Sunday roast is served from 12:00 PM to 5:00 PM.
                        </p>
                      </div>
                    </CardHeader>
                  </Card>

                  {roastSelected ? (
                    <Alert variant="success">
                      <AlertIcon>
                        <CheckCircle2 className="size-4" aria-hidden />
                      </AlertIcon>
                      <AlertTitle>Sunday roast added</AlertTitle>
                      <AlertDescription>
                        We’ll include this on your confirmation and flag it for the restaurant team.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : (
                <Alert variant="info">
                  <AlertIcon>
                    <Info className="size-4" aria-hidden />
                  </AlertIcon>
                  <AlertTitle>Weekday behaviour</AlertTitle>
                  <AlertDescription>
                    The Sunday roast control stays hidden in the real booking flow.
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <section className="flex flex-col gap-3" aria-labelledby="prototype-summary-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="prototype-summary-title" className="font-semibold">
                    Your visit
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="guest-chip-outline">{serviceLabel}</Badge>
                    {roastSelected ? <Badge variant="guest-chip">Sunday Roast</Badge> : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(date)} at {formatTime(time)} · {party}{' '}
                  {party === 1 ? 'guest' : 'guests'}
                </p>
              </section>
            </CardContent>

            <CardFooter className="justify-end border-t border-border pt-6">
              <Button variant="guest-primary" size="guest-lg">
                Continue
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6" aria-label="Staff preview">
            <Card variant="compact">
              <CardHeader className="gap-3 border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">Staff preview</Badge>
                  <Badge variant="status-confirmed">Confirmed</Badge>
                </div>
                <CardTitle className="text-xl">{formatTime(time)} · Guest Booker</CardTitle>
                <CardDescription>
                  {party} {party === 1 ? 'guest' : 'guests'} · {formatDate(date)}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="guest-chip-outline">{serviceLabel}</Badge>
                  {roastSelected ? (
                    <Badge variant="default">
                      <UtensilsCrossed className="mr-1 size-3" aria-hidden />
                      Sunday Roast
                    </Badge>
                  ) : (
                    <Badge variant="outline">Standard booking</Badge>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Booking type</dt>
                    <dd className="font-medium">{serviceLabel}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Occasion</dt>
                    <dd className="font-medium">{roastSelected ? 'Sunday Roast' : 'Standard'}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Party size</dt>
                    <dd className="font-medium">{party}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Roast covers</dt>
                    <dd className="font-medium">{roastSelected ? party : 0}</dd>
                  </div>
                </dl>

                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Structured booking signal
                  </p>
                  <code className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                    {roastSelected
                      ? '{ "occasion": "Sunday Roast", "sundayRoast": true }'
                      : '{ "occasion": "Standard", "sundayRoast": false }'}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Alert variant="warning">
              <AlertIcon>
                <Info className="size-4" aria-hidden />
              </AlertIcon>
              <AlertTitle>Prototype assumption</AlertTitle>
              <AlertDescription>
                The checkbox treats the whole party as roast covers. If mixed orders matter, this
                should become a guest-count selector.
              </AlertDescription>
            </Alert>
          </aside>
        </div>
      </div>
    </main>
  );
}
