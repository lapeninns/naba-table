/**
 * Host probes for the admission policy. Every parser is a pure function over
 * the command output so it can be unit tested without macOS; the probe runner
 * wraps them with an injectable command executor.
 */
export type PowerSource = 'ac' | 'battery' | 'ups' | 'unknown';

export interface PowerReading {
  readonly source: PowerSource;
  readonly batteryPercent: number | null;
}

export interface MemoryReading {
  readonly freePercent: number;
  readonly origin: 'memory_pressure' | 'vm_stat';
}

export interface ThermalReading {
  readonly cpuSpeedLimit: number;
  readonly availableCpus: number | null;
  readonly schedulerLimit: number | null;
}

export interface DiskReading {
  readonly availableGiB: number;
  readonly mountPoint: string;
}

export class ProbeParseError extends Error {
  constructor(
    readonly probe: string,
    message: string,
  ) {
    super(`${probe}: ${message}`);
    this.name = 'ProbeParseError';
  }
}

export function parsePmsetBattery(output: string): PowerReading {
  const sourceMatch = /Now drawing from '([^']+)'/u.exec(output);
  if (!sourceMatch) throw new ProbeParseError('pmset -g batt', 'no power source line');
  const label = sourceMatch[1]!.toLowerCase();
  const source: PowerSource = label.includes('ac')
    ? 'ac'
    : label.includes('battery')
      ? 'battery'
      : label.includes('ups')
        ? 'ups'
        : 'unknown';
  const percentMatch = /(\d{1,3})%/u.exec(output);
  const batteryPercent = percentMatch ? Math.min(100, Number(percentMatch[1])) : null;
  return { source, batteryPercent };
}

export function parseMemoryPressure(output: string): MemoryReading {
  const match = /System-wide memory free percentage:\s*(\d{1,3})%/u.exec(output);
  if (!match) throw new ProbeParseError('memory_pressure', 'no free percentage line');
  return { freePercent: Number(match[1]), origin: 'memory_pressure' };
}

const VM_STAT_FIELDS = [
  'free',
  'active',
  'inactive',
  'speculative',
  'wired down',
  'occupied by compressor',
] as const;

export function parseVmStat(output: string): MemoryReading {
  const values = new Map<string, number>();
  for (const field of VM_STAT_FIELDS) {
    const match = new RegExp(`Pages ${field}:\\s*(\\d+)\\.`, 'u').exec(output);
    if (match) values.set(field, Number(match[1]));
  }
  const free = values.get('free');
  if (free === undefined) throw new ProbeParseError('vm_stat', 'no "Pages free" line');
  const total = [...values.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new ProbeParseError('vm_stat', 'zero total pages');
  const reclaimable = free + (values.get('inactive') ?? 0) + (values.get('speculative') ?? 0);
  return { freePercent: Math.round((reclaimable / total) * 100), origin: 'vm_stat' };
}

export function parsePmsetThermal(output: string): ThermalReading {
  const read = (key: string): number | null => {
    const match = new RegExp(`${key}\\s*=\\s*(\\d+)`, 'u').exec(output);
    return match ? Number(match[1]) : null;
  };
  const cpuSpeedLimit = read('CPU_Speed_Limit');
  if (cpuSpeedLimit === null) {
    if (/No thermal warning level has been recorded/iu.test(output)) {
      return { cpuSpeedLimit: 100, availableCpus: null, schedulerLimit: null };
    }
    throw new ProbeParseError('pmset -g therm', 'no CPU_Speed_Limit line');
  }
  return {
    cpuSpeedLimit,
    availableCpus: read('CPU_Available_CPUs'),
    schedulerLimit: read('CPU_Scheduler_Limit'),
  };
}

export function parseDf(output: string): DiskReading {
  const lines = output.trim().split('\n');
  const dataLine = lines.slice(1).find((line) => line.trim().length > 0);
  if (!dataLine) throw new ProbeParseError('df -k', 'no data row');
  const columns = dataLine.trim().split(/\s+/u);
  // Filesystem 1024-blocks Used Available Capacity ... Mounted on
  const availableKb = Number(columns[3]);
  if (!Number.isFinite(availableKb) || availableKb < 0) {
    throw new ProbeParseError('df -k', 'available column is not numeric');
  }
  return {
    availableGiB: availableKb / (1024 * 1024),
    mountPoint: columns[columns.length - 1] ?? '/',
  };
}

export interface LondonClock {
  readonly hour: number;
  readonly minuteOfDay: number;
  readonly weekday: number; // 0 = Sunday .. 6 = Saturday
  readonly isoDate: string; // YYYY-MM-DD in Europe/London
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function londonClock(now: Date, timeZone = 'Europe/London'): LondonClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute')) % 60;
  const weekday = WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number]);
  return {
    hour,
    minuteOfDay: hour * 60 + minute,
    weekday: weekday < 0 ? 0 : weekday,
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<string>;

export interface AdmissionProbes {
  power(): Promise<PowerReading>;
  memory(): Promise<MemoryReading>;
  thermal(): Promise<ThermalReading>;
  disk(): Promise<DiskReading>;
}

export function createSystemProbes(run: CommandRunner, workspacePath: string): AdmissionProbes {
  return {
    power: async () => parsePmsetBattery(await run('pmset', ['-g', 'batt'])),
    memory: async () => {
      try {
        return parseMemoryPressure(await run('memory_pressure', []));
      } catch {
        return parseVmStat(await run('vm_stat', []));
      }
    },
    thermal: async () => parsePmsetThermal(await run('pmset', ['-g', 'therm'])),
    disk: async () => parseDf(await run('df', ['-k', workspacePath])),
  };
}
