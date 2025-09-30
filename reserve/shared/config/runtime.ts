const metaEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> })
  .env;
const processEnv =
  typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : undefined;

type ReadOptions = {
  fallback?: string;
  alternatives?: string[];
};

type BooleanOptions = Omit<ReadOptions, 'fallback'> & {
  fallback?: boolean;
};

type NumberOptions = Omit<ReadOptions, 'fallback'> & {
  fallback?: number;
};

const toBooleanString = (value: string | boolean | undefined): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return undefined;
};

const expandCandidate = (candidate: string): string[] => {
  const normalized = candidate.trim();
  if (normalized.length === 0) return [];
  if (normalized.startsWith('VITE_') || normalized.startsWith('NEXT_PUBLIC_')) {
    const bare = normalized.replace(/^(VITE_|NEXT_PUBLIC_)/, '');
    return [normalized, bare];
  }
  return [normalized, `VITE_${normalized}`, `NEXT_PUBLIC_${normalized}`];
};

const collectCandidates = (key: string, alternatives?: string[]): string[] => {
  const set = new Set<string>();
  [key, ...(alternatives ?? [])].forEach((candidate) => {
    expandCandidate(candidate).forEach((entry) => {
      if (entry) set.add(entry);
    });
  });
  return Array.from(set);
};

const readRaw = (key: string, options?: ReadOptions): string | undefined => {
  const candidates = collectCandidates(key, options?.alternatives);

  for (const candidate of candidates) {
    const fromMeta = toBooleanString(metaEnv?.[candidate]);
    if (typeof fromMeta === 'string') {
      return fromMeta;
    }
    const fromProcess = processEnv?.[candidate];
    if (typeof fromProcess === 'string' && fromProcess.length > 0) {
      return fromProcess;
    }
  }

  return options?.fallback;
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (typeof value !== 'string') return undefined;
  if (/^(true|1|yes)$/i.test(value.trim())) return true;
  if (/^(false|0|no)$/i.test(value.trim())) return false;
  return undefined;
};

const parseNumber = (value: string | undefined): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolvedMode = readRaw('MODE', { alternatives: ['NODE_ENV'] }) ?? 'production';

export const runtime = {
  mode: resolvedMode,
  isDev: resolvedMode === 'development',
  isTest: resolvedMode === 'test',
  readString: (key: string, options?: ReadOptions): string | undefined => readRaw(key, options),
  readBoolean: (key: string, options?: BooleanOptions): boolean | undefined => {
    const value = readRaw(key, options ? { alternatives: options.alternatives } : undefined);
    const parsed = parseBoolean(value);
    return parsed ?? options?.fallback;
  },
  readNumber: (key: string, options?: NumberOptions): number | undefined => {
    const value = readRaw(key, options ? { alternatives: options.alternatives } : undefined);
    const parsed = parseNumber(value);
    return parsed ?? options?.fallback;
  },
};

export type Runtime = typeof runtime;
