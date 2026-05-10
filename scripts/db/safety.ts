type ProductionScriptSafetyInput = {
  connectionString: string;
  expectedProjectRef: string;
  targetEnv?: string;
  apply?: boolean;
  destructive?: boolean;
  targetRestaurant?: string | null;
  requireRestaurant?: boolean;
  confirmation?: string;
  breakGlass?: string;
};

function extractProjectRefFromConnectionString(connectionString: string): string | null {
  const url = new URL(connectionString);
  const hostParts = url.hostname.split('.');
  const dbHostIndex = hostParts.indexOf('db');
  if (dbHostIndex >= 0 && hostParts[dbHostIndex + 1]) {
    return hostParts[dbHostIndex + 1];
  }

  const userMatch = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/i);
  if (userMatch) {
    return userMatch[1];
  }

  return null;
}

export function assertExactSupabaseProjectRef(
  connectionString: string,
  expectedProjectRef: string,
): string {
  const actual = extractProjectRefFromConnectionString(connectionString);
  if (!actual) {
    throw new Error('Unable to determine Supabase project ref from DB host/user.');
  }
  if (actual !== expectedProjectRef) {
    throw new Error(
      `Supabase project ref mismatch: expected ${expectedProjectRef}, received ${actual}.`,
    );
  }
  return actual;
}

export function assertExactSupabaseApiProjectRef(
  urlValue: string,
  expectedProjectRef: string,
): string {
  const url = new URL(urlValue);
  const [actual] = url.hostname.split('.');
  if (!actual || actual !== expectedProjectRef) {
    throw new Error(
      `Supabase API project ref mismatch: expected ${expectedProjectRef}, received ${actual || 'unknown'}.`,
    );
  }
  return actual;
}

export function assertProductionScriptSafety(input: ProductionScriptSafetyInput): void {
  if (input.requireRestaurant && !input.targetRestaurant?.trim()) {
    throw new Error('Target restaurant is required for this script.');
  }

  const targetEnv =
    input.targetEnv ?? process.env.DB_TARGET_ENV ?? process.env.APP_ENV ?? 'development';
  if (targetEnv !== 'production') return;

  assertExactSupabaseProjectRef(input.connectionString, input.expectedProjectRef);

  if (input.apply && input.confirmation !== 'true') {
    throw new Error('Production apply requires explicit confirmation.');
  }

  if (input.apply && input.destructive && input.breakGlass !== 'true') {
    throw new Error('Destructive production apply requires break-glass confirmation.');
  }
}
