type ProductionScriptSafetyInput = {
  connectionString: string;
  expectedProjectRef: string;
  targetEnv?: string;
  requireTargetEnv?: boolean;
  apply?: boolean;
  destructive?: boolean;
  targetRestaurant?: string | null;
  requireRestaurant?: boolean;
  confirmation?: string;
  confirmationName?: string;
  breakGlass?: string;
  breakGlassName?: string;
};

type ProductionApiScriptSafetyInput = {
  apiUrl: string;
  expectedProjectRef: string;
  targetEnv?: string;
  requireTargetEnv?: boolean;
  apply?: boolean;
  confirmation?: string;
  confirmationName?: string;
};

type StagingScriptSafetyInput = {
  apiUrl?: string;
  connectionString?: string;
  expectedProjectRef?: string | null;
  targetEnv?: string;
  confirmation?: string;
  confirmationName?: string;
};

export const DEFAULT_PRODUCTION_PROJECT_REF = 'vrdiqfudmwydclqpydee';
export const DEFAULT_STAGING_PROJECT_REF = 'ndxmivcrehsacuerwxtm';

export function normalizeSupabaseProjectRef(
  projectRef: string | null | undefined,
  name = 'EXPECTED_PROJECT_REF',
): string {
  const normalized = projectRef?.trim().toLowerCase();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  if (!/^[a-z0-9]{20}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-character Supabase project ref.`);
  }
  return normalized;
}

function extractProjectRefFromConnectionString(connectionString: string): string | null {
  const url = new URL(connectionString);
  const hostname = url.hostname.toLowerCase();
  const hostParts = url.hostname.split('.');
  if (
    hostParts.length === 4 &&
    hostParts[0] === 'db' &&
    hostParts[2] === 'supabase' &&
    hostParts[3] === 'co'
  ) {
    return hostParts[1] ?? null;
  }

  // The authenticated Supabase CLI issues a short-lived cli_login_postgres role.
  // Both supported pooler roles must still carry the exact project suffix.
  const userMatch = decodeURIComponent(url.username).match(
    /^(?:postgres|cli_login_postgres)\.([a-z0-9]{20})$/i,
  );
  if (userMatch && hostname.endsWith('.pooler.supabase.com')) {
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
  const expected = normalizeSupabaseProjectRef(expectedProjectRef);
  const url = new URL(urlValue);
  if (url.protocol !== 'https:') {
    throw new Error('Supabase API URL must use https.');
  }
  const expectedHost = `${expected}.supabase.co`;
  const actualHost = url.hostname.toLowerCase();
  if (actualHost !== expectedHost) {
    throw new Error(
      `Supabase API host mismatch: expected ${expectedHost}, received ${actualHost || 'unknown'}.`,
    );
  }
  return expected;
}

export function assertProductionScriptSafety(input: ProductionScriptSafetyInput): void {
  if (input.requireRestaurant && !input.targetRestaurant?.trim()) {
    throw new Error('Target restaurant is required for this script.');
  }

  const targetEnv =
    input.targetEnv?.trim().toLowerCase() ||
    process.env.DB_TARGET_ENV?.trim().toLowerCase() ||
    process.env.APP_ENV?.trim().toLowerCase() ||
    '';
  if (input.requireTargetEnv && targetEnv !== 'production') {
    throw new Error(
      'DB_TARGET_ENV=production or APP_ENV=production is required for production writes.',
    );
  }

  const expectedProjectRef = normalizeSupabaseProjectRef(
    input.expectedProjectRef,
    'EXPECTED_PRODUCTION_PROJECT_REF',
  );
  const actualProjectRef = extractProjectRefFromConnectionString(input.connectionString);
  if (!actualProjectRef) {
    throw new Error('Unable to determine Supabase project ref from DB host/user.');
  }

  const targetsProduction = targetEnv === 'production' || actualProjectRef === expectedProjectRef;
  if (!targetsProduction) return;

  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `Supabase project ref mismatch: expected ${expectedProjectRef}, received ${actualProjectRef}.`,
    );
  }

  if (input.apply && input.confirmation !== 'true') {
    const confirmationName = input.confirmationName ?? 'CONFIRM_PRODUCTION';
    throw new Error(`${confirmationName}=true is required before applying to production.`);
  }

  if (input.apply && input.destructive && input.breakGlass !== 'true') {
    const breakGlassName = input.breakGlassName ?? 'BREAK_GLASS_PRODUCTION';
    throw new Error(`${breakGlassName}=true is required for destructive production apply.`);
  }
}

export function assertProductionApiScriptSafety(input: ProductionApiScriptSafetyInput): void {
  const expectedProjectRef = normalizeSupabaseProjectRef(
    input.expectedProjectRef,
    'EXPECTED_PRODUCTION_PROJECT_REF',
  );
  const actualProjectRef = assertExactSupabaseApiProjectRef(input.apiUrl, expectedProjectRef);
  const targetEnv =
    input.targetEnv?.trim().toLowerCase() ||
    process.env.DB_TARGET_ENV?.trim().toLowerCase() ||
    process.env.APP_ENV?.trim().toLowerCase() ||
    '';

  if (input.requireTargetEnv && targetEnv !== 'production') {
    throw new Error(
      'DB_TARGET_ENV=production or APP_ENV=production is required for production writes.',
    );
  }

  const targetsProduction = targetEnv === 'production' || actualProjectRef === expectedProjectRef;
  if (targetsProduction && input.apply && input.confirmation !== 'true') {
    const confirmationName = input.confirmationName ?? 'CONFIRM_PRODUCTION';
    throw new Error(`${confirmationName}=true is required before applying to production.`);
  }
}

export function assertStagingScriptSafety(input: StagingScriptSafetyInput): string {
  const expectedProjectRef = normalizeSupabaseProjectRef(
    input.expectedProjectRef ?? DEFAULT_STAGING_PROJECT_REF,
    'EXPECTED_STAGING_PROJECT_REF',
  );
  if (expectedProjectRef === DEFAULT_PRODUCTION_PROJECT_REF) {
    throw new Error('Staging scripts cannot target the production Supabase project ref.');
  }
  const targetEnv =
    input.targetEnv?.trim().toLowerCase() ||
    process.env.DB_TARGET_ENV?.trim().toLowerCase() ||
    process.env.APP_ENV?.trim().toLowerCase() ||
    '';

  if (!targetEnv) {
    throw new Error('DB_TARGET_ENV=staging or APP_ENV=staging is required for staging writes.');
  }
  if (targetEnv !== 'staging') {
    throw new Error(`Refusing staging script against target env "${targetEnv}".`);
  }

  if (input.apiUrl) {
    assertExactSupabaseApiProjectRef(input.apiUrl, expectedProjectRef);
  }
  if (input.connectionString) {
    assertExactSupabaseProjectRef(input.connectionString, expectedProjectRef);
  }

  if (input.confirmation !== 'true') {
    const confirmationName = input.confirmationName ?? 'CONFIRM_STAGING_WRITE';
    throw new Error(`${confirmationName}=true is required before applying to staging.`);
  }

  return expectedProjectRef;
}
