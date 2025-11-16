#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";

type CliArgs = {
  date: string;
  start: string;
  end: string;
  intervalMinutes: number;
  stressMax: number;
  minPartySize: number;
  maxPartySize: number;
  baseUrl: string;
  logDir: string;
  pretty: boolean;
  concurrency: number;
};

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const [key, value] = argv[i].startsWith("--") ? argv[i].split("=", 2) : [argv[i], undefined];
    if (!key.startsWith("--")) continue;
    const param = key.slice(2);
    const next = typeof value === "undefined" ? argv[i + 1] : value;
    const consumeNext = typeof value === "undefined" && typeof next !== "undefined";
    const maybe = <T>(fallback: T, parser: (raw: string) => T) => {
      if (!next) return fallback;
      const result = parser(next);
      if (consumeNext) i += 1;
      return result;
    };

    switch (param) {
      case "date":
        if (!next) throw new Error("--date is required");
        args.date = next;
        if (consumeNext) i += 1;
        break;
      case "start":
        args.start = maybe(args.start ?? "12:00", (raw) => raw);
        break;
      case "end":
        args.end = maybe(args.end ?? "15:00", (raw) => raw);
        break;
      case "interval":
      case "interval-minutes":
        args.intervalMinutes = maybe(args.intervalMinutes ?? 15, (raw) => Number(raw));
        break;
      case "stress-max":
        args.stressMax = maybe(args.stressMax ?? 10, (raw) => Number(raw));
        break;
      case "min-party-size":
        args.minPartySize = maybe(args.minPartySize ?? 1, (raw) => Number(raw));
        break;
      case "max-party-size":
        args.maxPartySize = maybe(args.maxPartySize ?? 12, (raw) => Number(raw));
        break;
      case "base-url":
        args.baseUrl = maybe(args.baseUrl ?? "http://localhost:3000", (raw) => raw);
        break;
      case "log-dir":
        args.logDir = maybe(args.logDir ?? "tasks/booking-flow-script-20251114-0912/artifacts", (raw) => raw);
        break;
      case "pretty":
        args.pretty = maybe(true, (raw) => raw !== "false");
        break;
      case "parallel":
      case "concurrency":
        args.concurrency = maybe(args.concurrency ?? 1, (raw) => Number(raw));
        break;
      default:
        throw new Error(`Unknown flag: ${param}`);
    }
  }

  if (!args.date) {
    throw new Error("--date is required");
  }

  const cfg: CliArgs = {
    date: args.date,
    start: args.start ?? "12:00",
    end: args.end ?? "15:00",
    intervalMinutes: args.intervalMinutes ?? 15,
    stressMax: args.stressMax ?? 10,
    minPartySize: args.minPartySize ?? 1,
    maxPartySize: args.maxPartySize ?? 12,
    baseUrl: args.baseUrl ?? "http://localhost:3000",
    logDir: args.logDir ?? "tasks/booking-flow-script-20251114-0912/artifacts",
    pretty: args.pretty ?? true,
    concurrency: args.concurrency ?? 1,
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.date)) {
    throw new Error(`Invalid date format: ${cfg.date}`);
  }
  if (!/^\d{2}:\d{2}$/.test(cfg.start) || !/^\d{2}:\d{2}$/.test(cfg.end)) {
    throw new Error("start/end must be HH:mm");
  }
  if (cfg.intervalMinutes <= 0) {
    throw new Error("interval must be positive");
  }
  if (cfg.stressMax <= 0) {
    throw new Error("stress-max must be positive");
  }
  if (cfg.minPartySize <= 0 || cfg.maxPartySize < cfg.minPartySize) {
    throw new Error("invalid party size range");
  }
  if (cfg.concurrency <= 0) {
    throw new Error("concurrency must be positive");
  }
  return cfg;
}

function generateSlots(start: string, end: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  let cursor = DateTime.fromFormat(start, "HH:mm");
  const endTime = DateTime.fromFormat(end, "HH:mm");
  while (cursor < endTime) {
    slots.push(cursor.toFormat("HH:mm"));
    cursor = cursor.plus({ minutes: intervalMinutes });
  }
  if (cursor.equals(endTime)) {
    slots.push(endTime.toFormat("HH:mm"));
  }
  return slots;
}

async function runCommand(cmd: string[], logPath: string): Promise<number> {
  mkdirSync(join(logPath, ".."), { recursive: true });
  const stream = createWriteStream(logPath, { flags: "a" });
  return new Promise<number>((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), { env: process.env });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      stream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stream.write(chunk);
    });
    child.on("close", (code) => {
      stream.end();
      resolve(code ?? 0);
    });
  });
}

function randomParty(min: number, max: number): number {
  const range = max - min + 1;
  const value = Math.floor(Math.random() * range) + min;
  return value;
}

type SlotResult = {
  code: number;
  partySize: number;
  logFile: string;
  slot: string;
};

async function runSlot(slot: string, workerId: number, cfg: CliArgs): Promise<SlotResult> {
  const partySize = randomParty(cfg.minPartySize, cfg.maxPartySize);
  const timestamp = DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const logFile = join(
    cfg.logDir,
    `slot-fill-${cfg.date}-${slot.replace(":", "-")}-p${partySize}-${timestamp}-${randomSuffix}.log`,
  );
  const cmd = [
    "pnpm",
    "booking:flow",
    "--restaurant-slug",
    "white-horse-pub-waterbeach",
    "--date",
    cfg.date,
    "--time",
    slot,
    "--party-size",
    String(partySize),
    "--stress",
    "--stress-max",
    String(cfg.stressMax),
    "--timeout-ms",
    "180000",
    "--base-url",
    cfg.baseUrl,
  ];
  if (cfg.pretty) {
    cmd.push("--pretty");
  }

  console.log(`\n>>> [worker ${workerId}] Slot ${slot} (party ${partySize})`);
  const code = await runCommand(cmd, logFile);
  return { code, partySize, logFile, slot };
}

async function runSlotsWithConcurrency(slots: string[], cfg: CliArgs): Promise<boolean> {
  if (slots.length === 0) {
    return true;
  }

  let cursor = 0;
  let failure: SlotResult | null = null;
  const workerCount = Math.min(cfg.concurrency, slots.length);

  const workers = Array.from({ length: workerCount }, (_, index) =>
    (async () => {
      const workerId = index + 1;
      while (true) {
        if (failure) {
          break;
        }

        const slotIndex = cursor;
        if (slotIndex >= slots.length) {
          break;
        }
        cursor += 1;
        const slot = slots[slotIndex];

        const result = await runSlot(slot, workerId, cfg);
        if (result.code !== 0) {
          failure = result;
          break;
        }
      }
    })(),
  );

  await Promise.all(workers);

  if (failure !== null) {
    const { slot, partySize, code, logFile } = failure;
    console.error(`Slot ${slot} (party ${partySize}) failed (exit ${code}). See ${logFile}`);
    process.exitCode = code;
    return false;
  }

  return true;
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const slots = generateSlots(cfg.start, cfg.end, cfg.intervalMinutes);
  console.log(`Filling ${slots.length} slots on ${cfg.date} (stress-max=${cfg.stressMax})`);
  const success = await runSlotsWithConcurrency(slots, cfg);
  if (!success) {
    process.exit(process.exitCode ?? 1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
