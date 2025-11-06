#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "path";

loadEnv({ path: resolvePath(process.cwd(), ".env.local") });
loadEnv({ path: resolvePath(process.cwd(), ".env.development") });
loadEnv({ path: resolvePath(process.cwd(), ".env") });

import { env } from "@/lib/env";
import { getServiceSupabaseClient } from "@/server/supabase";

async function main(): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("feature_flag_overrides")
    .select("flag, environment, value, updated_at, updated_by")
    .order("flag")
    .order("environment");

  if (error) {
    console.error("[feature-flags][audit] failed to load overrides", {
      message: error.message ?? String(error),
    });
  }

  const overrides = new Map<string, Map<string, boolean>>();
  for (const row of data ?? []) {
    if (!row || typeof row.flag !== "string" || typeof row.environment !== "string") {
      continue;
    }
    const flagOverrides = overrides.get(row.flag) ?? new Map<string, boolean>();
    flagOverrides.set(row.environment, Boolean(row.value));
    overrides.set(row.flag, flagOverrides);
  }

  type FlagDescriptor = {
    label: string;
    flag: string;
    defaultValue: boolean | null;
    notes?: string;
  };

  const trackedFlags: FlagDescriptor[] = [
    {
      label: "holds.strictConflicts",
      flag: "holds.strict_conflicts.enabled",
      defaultValue: env.featureFlags.holds?.strictConflicts ?? null,
      notes: "Should be true in all environments to let DB enforce exclusions.",
    },
    {
      label: "holds.enabled",
      flag: "holds.enabled",
      defaultValue: env.featureFlags.holds?.enabled ?? null,
      notes: "Guard rails for allocator. Must stay true if strictConflicts true.",
    },
    {
      label: "allocator.requireAdjacency",
      flag: "allocator.require_adjacency",
      defaultValue: env.featureFlags.allocator?.requireAdjacency ?? null,
    },
    {
      label: "allocator.mergesEnabled",
      flag: "allocator.merges_enabled",
      defaultValue: env.featureFlags.allocator?.mergesEnabled ?? null,
      notes: "Unsafe when adjacency requirement disabled.",
    },
    {
      label: "selectorLookahead.enabled",
      flag: "selector.lookahead.enabled",
      defaultValue: env.featureFlags.selectorLookahead?.enabled ?? null,
    },
  ];

  const environments = new Set<string>();
  for (const envOverrides of overrides.values()) {
    for (const envName of envOverrides.keys()) {
      environments.add(envName);
    }
  }
  const envHeaders = Array.from(environments).sort();

  const rows: Array<string[]> = [];
  rows.push(["Flag", "Default", ...envHeaders.map((name) => name.toUpperCase()), "Notes"]);

  for (const descriptor of trackedFlags) {
    const flagOverrides = overrides.get(descriptor.flag) ?? new Map<string, boolean>();
    const row = [
      descriptor.label,
      descriptor.defaultValue === null ? "(unset)" : descriptor.defaultValue ? "true" : "false",
      ...envHeaders.map((envName) => {
        const override = flagOverrides.has(envName)
          ? flagOverrides.get(envName)
          : null;
        if (override === null || override === undefined) {
          return "—";
        }
        return override ? "true" : "false";
      }),
      descriptor.notes ?? "",
    ];
    rows.push(row);
  }

  const columnWidths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => (row[columnIndex] ?? "").length)),
  );

  const horizontalRule = columnWidths
    .map((width) => "-".repeat(width + 2))
    .join("+");

  const formatRow = (row: string[], isHeader = false): string =>
    row
      .map((cell, index) => {
        const width = columnWidths[index];
        const value = cell ?? "";
        const padding = width - value.length;
        return ` ${value}${" ".repeat(Math.max(0, padding))} `;
      })
      .join("|");

  console.log(horizontalRule);
  console.log(formatRow(rows[0], true));
  console.log(horizontalRule);
  for (let i = 1; i < rows.length; i += 1) {
    console.log(formatRow(rows[i]));
  }
  console.log(horizontalRule);
}

main().catch((error) => {
  console.error("[feature-flags][audit] unexpected failure", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
