export type FeatureFlagRegistration = {
  readonly key: string;
  readonly owner: string;
  readonly expiresAt: string;
  readonly removalIssue: string;
};

type ValidationInput = {
  readonly flags: readonly FeatureFlagRegistration[];
  readonly now: Date;
  readonly referencedKeys: ReadonlySet<string>;
};

function isExpired(expiresAt: string, now: Date): boolean {
  const expiry = Date.parse(`${expiresAt}T23:59:59.999Z`);
  return !Number.isFinite(expiry) || expiry < now.getTime();
}

export function validateFeatureFlagRegistry(input: ValidationInput): string[] {
  const issues: string[] = [];
  const registrations = new Map<string, number>();

  for (const flag of input.flags) {
    registrations.set(flag.key, (registrations.get(flag.key) ?? 0) + 1);

    if (isExpired(flag.expiresAt, input.now)) {
      issues.push(`Feature flag "${flag.key}" expired on ${flag.expiresAt}.`);
    }

    if (!input.referencedKeys.has(flag.key)) {
      issues.push(`Feature flag "${flag.key}" is registered but no longer referenced.`);
    }
  }

  for (const [key, count] of registrations) {
    if (count > 1) {
      issues.push(`Feature flag "${key}" has ${count} duplicate registrations.`);
    }
  }

  for (const key of input.referencedKeys) {
    if (!registrations.has(key)) {
      issues.push(`Feature flag "${key}" is referenced but unregistered.`);
    }
  }

  return issues;
}
