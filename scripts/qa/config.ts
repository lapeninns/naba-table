import fs from 'node:fs';

import type { QaRunIdEnv } from './run-id';

export type QaPersonaRole = 'guest' | 'ops' | 'owner' | 'support';

export type QaPersona = {
  email: string;
  key: string;
  magicLinkUrl?: string;
  otpSecret?: string;
  password?: string;
  phone?: string;
  role: QaPersonaRole;
  storageStatePath?: string;
};

export type QaPersonaConfig = {
  personas: Record<string, QaPersona>;
};

export type QaTestRestaurant = {
  id: string;
  key: string;
  name?: string;
  slug: string;
  tenantId?: string;
  timezone?: string;
};

export type QaTestRestaurantConfig = {
  restaurants: Record<string, QaTestRestaurant>;
};

export type QaConfigLoadOptions = {
  env?: QaRunIdEnv;
  json?: unknown;
  path?: string;
};

export type QaPersonaConfigLoadOptions = QaConfigLoadOptions & {
  requireAuthCredential?: boolean;
};

export type QaRestaurantConfigLoadOptions = QaConfigLoadOptions & {
  requireId?: boolean;
};

export class QaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QaConfigError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readJsonFromPath(pathValue: string): unknown {
  return JSON.parse(fs.readFileSync(pathValue, 'utf8')) as unknown;
}

function readJsonSource(
  options: QaConfigLoadOptions,
  jsonEnvKey: string,
  pathEnvKey: string,
  label: string,
): unknown {
  if (options.json !== undefined) return options.json;
  if (options.path) return readJsonFromPath(options.path);

  const env = options.env ?? process.env;
  const inlineJson = env[jsonEnvKey]?.trim();
  if (inlineJson) return JSON.parse(inlineJson) as unknown;

  const configPath = env[pathEnvKey]?.trim();
  if (configPath) return readJsonFromPath(configPath);

  throw new QaConfigError(`${label} requires ${jsonEnvKey} or ${pathEnvKey}.`);
}

function requireNonEmptyConfigObject(
  value: Record<string, unknown>,
  label: 'personas' | 'restaurants',
): void {
  if (Object.keys(value).length === 0) {
    throw new QaConfigError(`QA config ${label} object must contain at least one entry.`);
  }
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new QaConfigError(`${label}.${key} is required.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPersonaRole(value: string): value is QaPersonaRole {
  return value === 'guest' || value === 'ops' || value === 'owner' || value === 'support';
}

function hasAuthCredential(persona: QaPersona): boolean {
  return Boolean(
    persona.password || persona.otpSecret || persona.magicLinkUrl || persona.storageStatePath,
  );
}

export function loadQaPersonaConfig(options: QaPersonaConfigLoadOptions = {}): QaPersonaConfig {
  const raw = readJsonSource(
    options,
    'QA_PERSONA_CONFIG_JSON',
    'QA_PERSONA_CONFIG_PATH',
    'QA persona config',
  );
  if (!isRecord(raw) || !isRecord(raw.personas)) {
    throw new QaConfigError('QA persona config must contain a personas object.');
  }
  requireNonEmptyConfigObject(raw.personas, 'personas');

  const personas: Record<string, QaPersona> = {};
  for (const [key, rawPersona] of Object.entries(raw.personas)) {
    if (!isRecord(rawPersona)) {
      throw new QaConfigError(`personas.${key} must be an object.`);
    }

    const email = requireString(rawPersona, 'email', `personas.${key}`);
    if (!isValidEmail(email)) {
      throw new QaConfigError(`personas.${key}.email must be a valid email address.`);
    }

    const role = requireString(rawPersona, 'role', `personas.${key}`);
    if (!isPersonaRole(role)) {
      throw new QaConfigError(`personas.${key}.role must be guest, ops, owner, or support.`);
    }

    const persona: QaPersona = {
      email,
      key,
      magicLinkUrl: optionalString(rawPersona, 'magicLinkUrl'),
      otpSecret: optionalString(rawPersona, 'otpSecret'),
      password: optionalString(rawPersona, 'password'),
      phone: optionalString(rawPersona, 'phone'),
      role,
      storageStatePath: optionalString(rawPersona, 'storageStatePath'),
    };

    if ((options.requireAuthCredential ?? true) && !hasAuthCredential(persona)) {
      throw new QaConfigError(
        `personas.${key} requires one auth credential: password, otpSecret, magicLinkUrl, or storageStatePath.`,
      );
    }

    personas[key] = persona;
  }

  return { personas };
}

export function loadQaTestRestaurantConfig(
  options: QaRestaurantConfigLoadOptions = {},
): QaTestRestaurantConfig {
  const raw = readJsonSource(
    options,
    'QA_TEST_RESTAURANT_CONFIG_JSON',
    'QA_TEST_RESTAURANT_CONFIG_PATH',
    'QA test restaurant config',
  );
  if (!isRecord(raw) || !isRecord(raw.restaurants)) {
    throw new QaConfigError('QA test restaurant config must contain a restaurants object.');
  }
  requireNonEmptyConfigObject(raw.restaurants, 'restaurants');

  const restaurants: Record<string, QaTestRestaurant> = {};
  for (const [key, rawRestaurant] of Object.entries(raw.restaurants)) {
    if (!isRecord(rawRestaurant)) {
      throw new QaConfigError(`restaurants.${key} must be an object.`);
    }

    const slug = requireString(rawRestaurant, 'slug', `restaurants.${key}`);
    const id = optionalString(rawRestaurant, 'id') ?? '';
    if ((options.requireId ?? true) && !id) {
      throw new QaConfigError(`restaurants.${key}.id is required.`);
    }

    restaurants[key] = {
      id,
      key,
      name: optionalString(rawRestaurant, 'name'),
      slug,
      tenantId: optionalString(rawRestaurant, 'tenantId'),
      timezone: optionalString(rawRestaurant, 'timezone'),
    };
  }

  return { restaurants };
}
