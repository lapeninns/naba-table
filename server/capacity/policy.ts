import { DateTime } from "luxon";

const DEFAULT_TIMEZONE = "Europe/London";

export const SERVICE_KEYS = ["lunch", "dinner", "drinks"] as const;
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

export type ServiceDefinition = {
  key: ServiceKey;
  label: string;
  start: TimeOfDay;
  end: TimeOfDay;
  buffer: BufferConfig;
  turnBands: TurnBand[];
};

export type VenuePolicy = {
  timezone: string;
  services: Partial<Record<ServiceKey, ServiceDefinition>>;
  serviceOrder: ServiceKey[];
};

export type SelectorScoringWeights = {
  overage: number;
  tableCount: number;
  fragmentation: number;
  zoneBalance: number;
  adjacencyCost: number;
};

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

function cloneService(service: ServiceDefinition): ServiceDefinition {
  return {
    ...service,
    start: { ...service.start },
    end: { ...service.end },
    buffer: { ...service.buffer },
    turnBands: cloneTurnBands(service.turnBands),
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
      start: { hour: 17, minute: 0 },
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
    overage: 5,
    tableCount: 3,
    fragmentation: 2,
    zoneBalance: 4,
    adjacencyCost: 1,
  },
  maxOverage: 2,
  maxTables: 3,
};

export function getSelectorScoringConfig(): SelectorScoringConfig {
  return {
    weights: { ...defaultSelectorScoringConfig.weights },
    maxOverage: defaultSelectorScoringConfig.maxOverage,
    maxTables: defaultSelectorScoringConfig.maxTables,
  };
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
};

export function getVenuePolicy(options?: PolicyOptions): VenuePolicy {
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
  if (!bands || bands.length === 0) {
    throw new PolicyError(`No turn bands configured for service "${serviceKey}".`);
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

export function bandDuration(
  serviceKey: ServiceKey,
  partySize: number,
  policy: VenuePolicy = defaultVenuePolicy,
): number {
  return getTurnBand(serviceKey, partySize, policy).durationMinutes;
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
