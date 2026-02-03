import { DateTime } from "luxon";

import { DEFAULT_SCARCITY_WEIGHT, type StrategicConfigSnapshotOptions } from "./strategic-config";

const DEFAULT_TIMEZONE = "Europe/London";

export const SERVICE_KEYS = ["lunch", "dinner"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type TimeOfDay = {
  hour: number;
  minute: number;
};

export type BufferConfig = {
  pre: number;
  post: number;
};

export type TurnBand = {
  maxPartySize: number;
  durationMinutes: number;
};

export type TurnBandsByOption = Record<string, TurnBand[]>;

export type ServiceDefinition = {
  key: ServiceKey;
  label: string;
  start: TimeOfDay;
  end: TimeOfDay;
  buffer: BufferConfig;
  turnBands: TurnBand[];
  allowOverrun?: boolean;
};

export type VenuePolicy = {
  timezone: string;
  services: Partial<Record<ServiceKey, ServiceDefinition>>;
  serviceOrder: ServiceKey[];
  turnBandsByOption?: TurnBandsByOption;
};

export type SelectorScoringWeights = {
  overage: number;
  tableCount: number;
  fragmentation: number;
  zoneBalance: number;
  adjacencyCost: number;
  scarcity: number;
};

export const YIELD_MANAGEMENT_SCARCITY_WEIGHT = DEFAULT_SCARCITY_WEIGHT;

export type SelectorScoringConfig = {
  weights: SelectorScoringWeights;
  maxOverage: number;
  maxTables: number;
};

export type ServiceWindow = {
  start: DateTime;
  end: DateTime;
};

function cloneTurnBands(bands: TurnBand[]): TurnBand[] {
  return bands.map((band) => ({ ...band }));
}

function cloneTurnBandsByOption(input?: TurnBandsByOption): TurnBandsByOption | undefined {
  if (!input) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, bands]) => [key, cloneTurnBands(bands ?? [])]),
  );
}

function cloneService(service: ServiceDefinition): ServiceDefinition {
  return {
    ...service,
    start: { ...service.start },
    end: { ...service.end },
    buffer: { ...service.buffer },
    turnBands: cloneTurnBands(service.turnBands),
    allowOverrun: service.allowOverrun ?? false,
  };
}

export const defaultVenuePolicy: VenuePolicy = {
  timezone: DEFAULT_TIMEZONE,
  serviceOrder: ["lunch", "dinner"],
  services: {
    lunch: {
      key: "lunch",
      label: "Lunch",
      start: { hour: 12, minute: 0 },
      end: { hour: 15, minute: 0 },
      buffer: { pre: 0, post: 5 },
      allowOverrun: true,
      turnBands: [
        { maxPartySize: 2, durationMinutes: 60 },
        { maxPartySize: 4, durationMinutes: 75 },
        { maxPartySize: 6, durationMinutes: 85 },
        { maxPartySize: 8, durationMinutes: 85 },
      ],
    },
    dinner: {
      key: "dinner",
      label: "Dinner",
      start: { hour: 16, minute: 0 },
      end: { hour: 22, minute: 0 },
      buffer: { pre: 0, post: 5 },
      turnBands: [
        { maxPartySize: 2, durationMinutes: 60 },
        { maxPartySize: 4, durationMinutes: 75 },
        { maxPartySize: 6, durationMinutes: 85 },
        { maxPartySize: 8, durationMinutes: 90 },
      ],
    },
  },
};

const defaultSelectorScoringConfig: SelectorScoringConfig = {
  weights: {
    overage: 1,
    tableCount: 2,
    fragmentation: 0,
    zoneBalance: 0,
    adjacencyCost: 0,
    scarcity: 0,
  },
  maxOverage: 4,
  maxTables: 3,
};

export function getSelectorScoringConfig(_options?: StrategicConfigSnapshotOptions): SelectorScoringConfig {
  return {
    weights: { ...defaultSelectorScoringConfig.weights },
    maxOverage: defaultSelectorScoringConfig.maxOverage,
    maxTables: defaultSelectorScoringConfig.maxTables,
  };
}

export function getYieldManagementScarcityWeight(_options?: StrategicConfigSnapshotOptions): number {
  return DEFAULT_SCARCITY_WEIGHT;
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

export class ServiceNotFoundError extends PolicyError {
  constructor(public readonly attempted: DateTime, message?: string) {
    super(message ?? `No service window matches ${attempted.toISO() ?? "provided time"}.`);
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceOverrunError extends PolicyError {
  constructor(
    public readonly service: ServiceKey,
    public readonly attemptedEnd: DateTime,
    public readonly serviceEnd: DateTime,
    message?: string,
  ) {
    super(
      message ??
      `Reservation would overrun ${service} service (end ${serviceEnd.toFormat("HH:mm")}).`,
    );
    this.name = "ServiceOverrunError";
  }
}

type PolicyOptions = {
  timezone?: string | null;
  turnBandsByOption?: TurnBandsByOption | null;
};

export function getVenuePolicy(options?: PolicyOptions): VenuePolicy {
  const turnBandsByOption = options?.turnBandsByOption ?? undefined;

  if (!options?.timezone || options.timezone === defaultVenuePolicy.timezone) {
    return {
      timezone: defaultVenuePolicy.timezone,
      serviceOrder: [...defaultVenuePolicy.serviceOrder],
      services: Object.fromEntries(
        Object.entries(defaultVenuePolicy.services).map(([key, service]) => [
          key,
          service ? cloneService(service) : service,
        ]),
      ),
      ...(turnBandsByOption ? { turnBandsByOption: cloneTurnBandsByOption(turnBandsByOption) } : {}),
    };
  }

  return {
    timezone: options.timezone,
    serviceOrder: [...defaultVenuePolicy.serviceOrder],
    services: Object.fromEntries(
      Object.entries(defaultVenuePolicy.services).map(([key, service]) => [
        key,
        service ? cloneService(service) : service,
      ]),
    ),
    ...(turnBandsByOption ? { turnBandsByOption: cloneTurnBandsByOption(turnBandsByOption) } : {}),
  };
}

function toZonedBase(dateTime: DateTime, timezone: string): DateTime {
  const candidate = dateTime.isValid ? dateTime : DateTime.invalid("Invalid start time");
  const zoned = candidate.setZone(timezone, { keepLocalTime: false });
  if (!zoned.isValid) {
    throw new PolicyError(`Invalid DateTime for policy computation: ${candidate.invalidReason ?? "unknown reason"}`);
  }
  return zoned;
}

function toDateTime(base: DateTime, time: TimeOfDay): DateTime {
  return base.set({
    hour: time.hour,
    minute: time.minute,
    second: 0,
    millisecond: 0,
  });
}

function resolveServiceWindow(base: DateTime, service: ServiceDefinition): ServiceWindow {
  const start = toDateTime(base, service.start);
  let end = toDateTime(base, service.end);
  if (end <= start) {
    end = end.plus({ days: 1 });
  }
  return { start, end };
}

function activeServices(policy: VenuePolicy): ServiceDefinition[] {
  return policy.serviceOrder
    .map((key) => policy.services[key])
    .filter((service): service is ServiceDefinition => Boolean(service));
}

export function whichService(dateTime: DateTime, policy: VenuePolicy = defaultVenuePolicy): ServiceKey | null {
  const zoned = toZonedBase(dateTime, policy.timezone);

  for (const service of activeServices(policy)) {
    const window = resolveServiceWindow(zoned, service);
    if (zoned >= window.start && zoned < window.end) {
      return service.key;
    }
  }

  return null;
}

export function serviceWindowFor(
  serviceKey: ServiceKey,
  dateTime: DateTime,
  policy: VenuePolicy = defaultVenuePolicy,
): ServiceWindow {
  const service = policy.services[serviceKey];
  if (!service) {
    throw new PolicyError(`Unknown service "${serviceKey}".`);
  }

  const zoned = toZonedBase(dateTime, policy.timezone);
  return resolveServiceWindow(zoned, service);
}

export function serviceEnd(
  serviceKey: ServiceKey,
  dateTime: DateTime,
  policy: VenuePolicy = defaultVenuePolicy,
): DateTime {
  return serviceWindowFor(serviceKey, dateTime, policy).end;
}

function normalizeBookingOptionKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toString().trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function selectTurnBand(bands: TurnBand[], partySize: number): TurnBand {
  if (!bands || bands.length === 0) {
    throw new PolicyError("No turn bands configured.");
  }

  if (!Number.isFinite(partySize) || partySize <= 0) {
    return bands[0]!;
  }

  for (const band of bands) {
    if (partySize <= band.maxPartySize) {
      return band;
    }
  }

  return bands[bands.length - 1]!;
}

export function getTurnBand(
  serviceKey: ServiceKey,
  partySize: number,
  policy: VenuePolicy = defaultVenuePolicy,
): TurnBand {
  const service = policy.services[serviceKey];
  if (!service) {
    throw new PolicyError(`Unknown service "${serviceKey}".`);
  }

  const bands = service.turnBands;
  try {
    return selectTurnBand(bands, partySize);
  } catch (error) {
    if (error instanceof PolicyError) {
      throw new PolicyError(`No turn bands configured for service "${serviceKey}".`);
    }
    throw error;
  }
}

export function resolveTurnBand(args: {
  serviceKey: ServiceKey;
  partySize: number;
  bookingOption?: string | null;
  policy?: VenuePolicy;
}): TurnBand {
  const policy = args.policy ?? defaultVenuePolicy;
  const optionKey = normalizeBookingOptionKey(args.bookingOption);
  const overrideBands = optionKey ? policy.turnBandsByOption?.[optionKey] : undefined;

  if (overrideBands && overrideBands.length > 0) {
    return selectTurnBand(overrideBands, args.partySize);
  }

  return getTurnBand(args.serviceKey, args.partySize, policy);
}

export function bandDuration(
  serviceKey: ServiceKey,
  partySize: number,
  policy: VenuePolicy = defaultVenuePolicy,
  bookingOption?: string | null,
): number {
  return resolveTurnBand({ serviceKey, partySize, bookingOption, policy }).durationMinutes;
}

export function getBufferConfig(
  serviceKey: ServiceKey,
  policy: VenuePolicy = defaultVenuePolicy,
): BufferConfig {
  const service = policy.services[serviceKey];
  if (!service) {
    throw new PolicyError(`Unknown service "${serviceKey}".`);
  }
  return { ...service.buffer };
}
