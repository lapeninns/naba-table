import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

import { MenuItemUpsertInputSchema, type MenuItemUpsertInput } from '../server/menu/types';

type DishRow = {
  Item: string;
  'Short Description'?: string;
  'Key Ingredients'?: string;
  'Main Protein/Base'?: string;
  'Cooking Style'?: string;
  'Preparation Method'?: string;
  Appearance?: string;
  'Flavor Profile'?: string;
  Texture?: string;
  'Spice Level'?: string;
  Allergens?: string;
  'Dietary Info'?: string;
  'Bone/Boneless'?: string;
  'Sauce/Dry'?: string;
  'Popular Pairings'?: string;
  'Portion Size'?: string;
  'Customisation Notes'?: string;
  Price?: string;
};

type SourcePayload = {
  venue: string;
  generatedOn: string;
  notes?: string[];
  items: DishRow[];
};

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string | null;
  capacity: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  google_map_url: string | null;
  google_review_url: string | null;
  booking_policy: string | null;
  logo_url: string | null;
  email_send_reminder_24h: boolean | null;
  email_send_reminder_short: boolean | null;
  email_send_review_request: boolean | null;
  reservation_interval_minutes: number | null;
  reservation_default_duration_minutes: number | null;
  reservation_last_seating_buffer_minutes: number | null;
  reservation_lifecycle_grace_minutes: number | null;
  email_templates: unknown;
  manager_daily_summary_enabled: boolean | null;
  manager_notification_phone: string | null;
  is_active: boolean | null;
};

type MembershipRow = {
  user_id: string;
  role: string;
  restaurant_id: string;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const APPLY = process.env.APPLY === 'true';
const SOURCE_RESTAURANT_SLUG = process.env.SOURCE_RESTAURANT_SLUG?.trim() || 'the-old-crown-girton';
const TARGET_SLUG = process.env.TARGET_SLUG?.trim() || 'the-old-school-house';
const TARGET_NAME = process.env.TARGET_NAME?.trim() || 'The Old School House';
const SOURCE_JSON_PATH =
  process.env.SOURCE_JSON_PATH?.trim() ||
  '/Users/amankumarshrestha/LapenInns Project/Menu/theoldschoolhousemenu-standalone/dish-content-table.json';
const TASK_DIR =
  process.env.TASK_DIR?.trim() ||
  path.join(projectRoot, 'tasks', 'menu-staging-import-20260418-0742');
const ARTIFACTS_DIR = path.join(TASK_DIR, 'artifacts');
const poolerPath = path.join(projectRoot, 'supabase/.temp/pooler-url');

const TARGET_OVERRIDES = {
  address: 'London Rd, Stony Stratford, Milton Keynes MK11 1JA',
  contact_email: 'oldschoolhouse@lapeninns.com',
  contact_phone: '01908 561936',
  google_map_url:
    'https://www.google.com/maps/dir/?api=1&destination=London%20Rd%2C%20Stony%20Stratford%2C%20Milton%20Keynes%20MK11%201JA&travelmode=driving',
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const directDbUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!directDbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function buildPgConnectionString(): string {
  const direct = new URL(directDbUrl!);
  if (!fs.existsSync(poolerPath)) {
    return direct.toString();
  }

  const pooler = new URL(fs.readFileSync(poolerPath, 'utf8').trim());
  pooler.password = direct.password;
  return pooler.toString();
}

async function withPgClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: buildPgConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function writeJsonArtifact(name: string, value: unknown) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s/_]+/g, '-')
    .replace(/-+/g, '-');
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function compact<T>(values: Array<T | null | undefined | false>): T[] {
  return values.filter(Boolean) as T[];
}

function dedupe(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return dedupe(
    value
      .split(/[,;/]/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function sanitizeKeyIngredients(value: string | undefined, mainBase: string | null): string[] {
  const generic = new Set([
    'house recipe base',
    'house seasoning',
    'core ingredients as per dish name',
    'mixed starter selection',
  ]);

  const cleaned = splitList(value).filter((entry) => !generic.has(entry.toLowerCase()));
  if (mainBase && !generic.has(mainBase.toLowerCase())) {
    cleaned.unshift(mainBase);
  }

  return dedupe(cleaned.map((entry) => entry.replace(/\s+/g, ' ').trim()));
}

function extractFirstPrice(price: string | undefined): number {
  const matches = price?.match(/\d+\.\d{1,2}/g) ?? [];
  const parsed = Number.parseFloat(matches[0] ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractPriceNote(price: string | undefined): string | null {
  if (!price) return null;
  const matches = price.match(/\d+\.\d{1,2}/g) ?? [];
  if (matches.length <= 1) return null;
  return `Source pricing includes variants or menu-specific pricing: ${price}.`;
}

function normalizeNullableText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function trimSentence(value: string): string {
  return value.trim().replace(/[.!\s]+$/g, '');
}

function normalizeMainBase(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'house recipe base') return null;
  return trimmed;
}

function inferCategory(style: string, portionSize: string, itemName: string): { category: string; subcategory: string | null } {
  const styleKey = style.toLowerCase();
  const portionKey = portionSize.toLowerCase();
  const nameKey = itemName.toLowerCase();

  if (portionKey.includes('starter') || styleKey.includes('starter')) {
    return { category: 'Starters', subcategory: titleCase(style) || 'Small Plates' };
  }
  if (portionKey.includes('side') || styleKey.includes('side') || styleKey.includes('flatbread') || styleKey.includes('rice')) {
    return { category: 'Sides', subcategory: titleCase(style) || 'Sides' };
  }
  if (portionKey.includes('dessert') || styleKey.includes('dessert')) {
    return { category: 'Desserts', subcategory: titleCase(style) || 'Desserts' };
  }
  if (portionKey.includes('kids') || styleKey.includes('kids')) {
    return { category: 'Kids', subcategory: titleCase(style) || 'Kids Menu' };
  }
  if (styleKey.includes('breakfast')) {
    return { category: 'Breakfast', subcategory: titleCase(style) };
  }
  if (styleKey.includes('roast')) {
    return { category: 'Roasts', subcategory: titleCase(style) };
  }
  if (
    styleKey.includes('filled baguette') ||
    styleKey.includes('filled wrap') ||
    styleKey.includes('loaded jacket potato') ||
    styleKey.includes('cold salad plate')
  ) {
    return { category: 'Lunch', subcategory: titleCase(style) };
  }
  if (styleKey.includes('burger') || styleKey.includes('pub-style')) {
    return { category: 'Pub Classics', subcategory: titleCase(style) };
  }
  if (styleKey.includes('curry')) {
    return { category: 'Curries', subcategory: titleCase(style) };
  }
  if (styleKey.includes('tandoor') || styleKey.includes('grill')) {
    return { category: 'Grill & Tandoor', subcategory: titleCase(style) };
  }
  if (styleKey.includes('biryani') || styleKey.includes('noodle') || nameKey.includes('biryani') || nameKey.includes('chowmein')) {
    return { category: 'Mains', subcategory: titleCase(style) || 'Mains' };
  }

  return { category: 'Menu', subcategory: titleCase(style) || null };
}

function inferServiceTime(style: string, portionSize: string): string | null {
  const styleKey = style.toLowerCase();
  const portionKey = portionSize.toLowerCase();

  if (styleKey.includes('breakfast')) return 'Breakfast';
  if (styleKey.includes('roast')) return 'Sunday';
  if (portionKey.includes('light main / lunch portion') || styleKey.includes('filled baguette') || styleKey.includes('filled wrap') || styleKey.includes('loaded jacket potato') || styleKey.includes('cold salad plate')) {
    return 'Lunch';
  }
  if (portionKey.includes('kids') || styleKey.includes('kids')) return 'Kids';
  return 'All Day';
}

function inferDietaryTags(dietaryInfo: string | undefined): string[] {
  const key = dietaryInfo?.toLowerCase() ?? '';
  return dedupe(
    compact([
      key.includes('vegetarian') ? 'vegetarian' : null,
      key.includes('vegan') ? 'vegan' : null,
      key.includes('menu-marked gf') ? 'gluten-free' : null,
    ]),
  );
}

function parseAllergens(allergens: string | undefined): { contains: string[]; mayContain: string[] } {
  const key = allergens?.toLowerCase() ?? '';
  const contains = new Set<string>();
  const mayContain = new Set<string>();

  const allergenMap = [
    'gluten',
    'milk',
    'nuts',
    'egg',
    'fish',
    'shellfish',
    'crustaceans',
    'soy',
    'mustard',
  ];

  allergenMap.forEach((allergen) => {
    if (key.includes(`likely ${allergen}`)) {
      mayContain.add(allergen === 'crustaceans' ? 'shellfish' : allergen);
    } else if (key.includes(allergen)) {
      contains.add(allergen === 'crustaceans' ? 'shellfish' : allergen);
    }
  });

  return {
    contains: Array.from(contains),
    mayContain: Array.from(mayContain).filter((entry) => !contains.has(entry)),
  };
}

function inferRecommendationTags(category: string, serviceTime: string | null, itemName: string, signatureScore: number | null, popularityScore: number | null, shareable: boolean): string[] {
  const key = itemName.toLowerCase();
  return dedupe(
    compact([
      category === 'Starters' ? 'starter' : null,
      category === 'Curries' ? 'curry-house' : null,
      category === 'Grill & Tandoor' ? 'grill' : null,
      category === 'Pub Classics' ? 'pub-classic' : null,
      serviceTime === 'Lunch' ? 'lunch-favourite' : null,
      key.includes('prawn') || key.includes('fish') || key.includes('salmon') || key.includes('scampi') ? 'seafood' : null,
      signatureScore !== null && signatureScore >= 80 ? 'signature' : null,
      popularityScore !== null && popularityScore >= 80 ? 'popular' : null,
      shareable ? 'sharer' : null,
    ]),
  );
}

function inferSignatureScore(itemName: string, style: string): number | null {
  const key = `${itemName} ${style}`.toLowerCase();
  let score = 40;

  const boosts: Array<[RegExp, number]> = [
    [/himali|pokhareli|kathmandu|gurkha|nepalese|khasi|bhutuwa|rara|lasun/i, 35],
    [/special|signature/i, 25],
    [/mixed grill|rack of lamb|tandoori king prawn|salmon tikka/i, 18],
    [/momo|onion bhaji|fish curry|goat curry/i, 12],
  ];

  boosts.forEach(([pattern, value]) => {
    if (pattern.test(key)) {
      score += value;
    }
  });

  return Math.min(score, 95);
}

function inferPopularityScore(itemName: string, category: string): number | null {
  const key = itemName.toLowerCase();
  let score =
    category === 'Pub Classics'
      ? 74
      : category === 'Curries'
        ? 72
        : category === 'Starters'
          ? 68
          : category === 'Sides'
            ? 64
            : category === 'Desserts'
              ? 62
              : 60;

  const boosts: Array<[RegExp, number]> = [
    [/tikka masala|butter chicken|fish & chips|burger|mixed grill/i, 18],
    [/onion bhaji|naan|biryani|chowmein|chicken tikka|scampi/i, 12],
    [/momo|korma|madras|jalfrezi|karahi|vindaloo/i, 8],
  ];

  boosts.forEach(([pattern, value]) => {
    if (pattern.test(key)) {
      score += value;
    }
  });

  return Math.min(score, 95);
}

function inferShortDescription(row: DishRow): string {
  const raw = row['Short Description']?.trim() ?? '';
  if (
    raw &&
    !/^invented profile based/i.test(raw) &&
    !/^choose\s/i.test(raw)
  ) {
    return raw;
  }

  const name = row.Item.trim();
  const flavor = normalizeNullableText(row['Flavor Profile']);
  if (flavor) {
    return `${trimSentence(name)} with ${trimSentence(flavor).charAt(0).toLowerCase()}${trimSentence(flavor).slice(1)}.`;
  }

  return `${trimSentence(name)} prepared in the house style.`;
}

function inferFullDescription(row: DishRow, shortDescription: string): string {
  const preparation = normalizeNullableText(row['Preparation Method']);
  const texture = normalizeNullableText(row.Texture);
  const parts = dedupe(
    compact([
      shortDescription,
      preparation,
      texture ? `Finished with ${texture.charAt(0).toLowerCase()}${texture.slice(1)}.` : null,
    ]),
  );
  return parts.join(' ');
}

function inferServingNotes(row: DishRow): string | null {
  const notes = compact([
    normalizeNullableText(row.Appearance),
    normalizeNullableText(row['Sauce/Dry']) ? `Format: ${normalizeNullableText(row['Sauce/Dry'])}.` : null,
    normalizeNullableText(row['Bone/Boneless']) && !/not specified/i.test(row['Bone/Boneless'] ?? '')
      ? `Cut: ${normalizeNullableText(row['Bone/Boneless'])}.`
      : null,
  ]);

  return notes.length > 0 ? notes.join(' ') : null;
}

function inferCustomizationRules(row: DishRow): string | null {
  const notes = compact([
    normalizeNullableText(row['Customisation Notes']),
    extractPriceNote(row.Price),
  ]);
  return notes.length > 0 ? notes.join(' ') : null;
}

function inferBooleanFromText(value: string | undefined, needle: RegExp): boolean {
  return needle.test(value?.toLowerCase() ?? '');
}

function buildExternalIds(items: DishRow[]): string[] {
  const counts = new Map<string, number>();
  return items.map((row) => {
    const base = slugify(row.Item);
    const next = (counts.get(base) ?? 0) + 1;
    counts.set(base, next);
    return next === 1 ? base : `${base}-${next}`;
  });
}

function normalizeItem(row: DishRow, externalItemId: string, displayOrder: number): MenuItemUpsertInput {
  const itemName = row.Item.trim();
  const style = normalizeNullableText(row['Cooking Style']) ?? 'Menu item';
  const portionSize = normalizeNullableText(row['Portion Size']) ?? 'Main';
  const { category, subcategory } = inferCategory(style, portionSize, itemName);
  const serviceTime = inferServiceTime(style, portionSize);
  const shortDescription = inferShortDescription(row);
  const fullDescription = inferFullDescription(row, shortDescription);
  const mainProteinOrBase = normalizeMainBase(row['Main Protein/Base']);
  const allergens = parseAllergens(row.Allergens);
  const dietaryTags = inferDietaryTags(row['Dietary Info']);
  const shareable =
    portionSize.toLowerCase().includes('sharer') ||
    portionSize.toLowerCase().includes('sharing') ||
    /mixed platter|mixed grill/i.test(itemName);
  const signatureScore = inferSignatureScore(itemName, style);
  const popularityScore = inferPopularityScore(itemName, category);
  const recommendationTags = inferRecommendationTags(
    category,
    serviceTime,
    itemName,
    signatureScore,
    popularityScore,
    shareable,
  );

  return MenuItemUpsertInputSchema.parse({
    externalItemId,
    itemName,
    category,
    subcategory,
    shortDescription,
    fullDescription,
    basePrice: extractFirstPrice(row.Price),
    currency: 'GBP',
    serviceTime,
    availabilityStatus: 'available',
    keyIngredients: sanitizeKeyIngredients(row['Key Ingredients'], mainProteinOrBase),
    mainProteinOrBase,
    cookingStyle: style,
    preparationMethod: normalizeNullableText(row['Preparation Method']),
    flavorProfile: normalizeNullableText(row['Flavor Profile']),
    texture: normalizeNullableText(row.Texture),
    spiceLevel: normalizeNullableText(row['Spice Level']),
    spiceAdjustable: category === 'Curries' || inferBooleanFromText(row['Customisation Notes'], /choose|variant|price varies/),
    portionSize,
    shareable,
    recommendationTags,
    pairings: splitList(row['Popular Pairings']),
    signatureScore,
    popularityScore,
    dietaryTags,
    allergensContains: allergens.contains,
    allergensMayContain: allergens.mayContain,
    removableIngredients: [],
    substitutionsAllowed: inferBooleanFromText(row['Customisation Notes'], /choose|variant|substitute|price varies/),
    canBeMadeVegetarian: dietaryTags.includes('vegetarian'),
    canBeMadeVegan: dietaryTags.includes('vegan'),
    canBeMadeGlutenFree: dietaryTags.includes('gluten-free'),
    customizationRules: inferCustomizationRules(row),
    servingNotes: inferServingNotes(row),
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder,
    imageUrl: null,
    modifierGroups: [],
  });
}

async function loadSourcePayload(): Promise<SourcePayload> {
  const raw = fs.readFileSync(SOURCE_JSON_PATH, 'utf8');
  return JSON.parse(raw) as SourcePayload;
}

async function loadSourceRestaurant(): Promise<RestaurantRow> {
  const { data, error } = await supabase.from('restaurants').select('*').eq('slug', SOURCE_RESTAURANT_SLUG).maybeSingle();
  if (error) {
    throw new Error(`Failed to load source restaurant "${SOURCE_RESTAURANT_SLUG}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Source restaurant "${SOURCE_RESTAURANT_SLUG}" was not found.`);
  }
  return data as RestaurantRow;
}

async function ensureTargetRestaurant(sourceRestaurant: RestaurantRow): Promise<{ restaurantId: string; existed: boolean }> {
  return withPgClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      'select id from public.restaurants where slug = $1 limit 1',
      [TARGET_SLUG],
    );

    if (existing.rows[0]?.id) {
      return { restaurantId: existing.rows[0].id, existed: true };
    }

    if (!APPLY) {
      return { restaurantId: 'dry-run-target-restaurant', existed: false };
    }

    const created = await client.query<{ id: string }>(
      `
        insert into public.restaurants (
          name,
          slug,
          timezone,
          capacity,
          contact_email,
          contact_phone,
          address,
          google_map_url,
          google_review_url,
          booking_policy,
          logo_url,
          email_send_reminder_24h,
          email_send_reminder_short,
          email_send_review_request,
          reservation_interval_minutes,
          reservation_default_duration_minutes,
          reservation_last_seating_buffer_minutes,
          reservation_lifecycle_grace_minutes,
          email_templates,
          manager_daily_summary_enabled,
          manager_notification_phone,
          is_active
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
        )
        returning id
      `,
      [
        TARGET_NAME,
        TARGET_SLUG,
        sourceRestaurant.timezone ?? 'Europe/London',
        sourceRestaurant.capacity,
        TARGET_OVERRIDES.contact_email,
        TARGET_OVERRIDES.contact_phone,
        TARGET_OVERRIDES.address,
        TARGET_OVERRIDES.google_map_url,
        sourceRestaurant.google_review_url,
        sourceRestaurant.booking_policy,
        sourceRestaurant.logo_url,
        sourceRestaurant.email_send_reminder_24h,
        sourceRestaurant.email_send_reminder_short,
        sourceRestaurant.email_send_review_request,
        sourceRestaurant.reservation_interval_minutes,
        sourceRestaurant.reservation_default_duration_minutes,
        sourceRestaurant.reservation_last_seating_buffer_minutes,
        sourceRestaurant.reservation_lifecycle_grace_minutes,
        sourceRestaurant.email_templates,
        sourceRestaurant.manager_daily_summary_enabled,
        sourceRestaurant.manager_notification_phone,
        true,
      ],
    );

    return { restaurantId: created.rows[0]!.id, existed: false };
  });
}

async function ensureMemberships(sourceRestaurantId: string, targetRestaurantId: string): Promise<{ copied: number; total: number }> {
  return withPgClient(async (client) => {
    const sourceMemberships = await client.query<MembershipRow>(
      `select user_id, role, restaurant_id
       from public.restaurant_memberships
       where restaurant_id = $1
         and role = any($2::text[])`,
      [sourceRestaurantId, ['owner', 'manager']],
    );

    const targetMemberships = await client.query<MembershipRow>(
      `select user_id, role, restaurant_id
       from public.restaurant_memberships
       where restaurant_id = $1`,
      [targetRestaurantId],
    );

    const existing = new Set(targetMemberships.rows.map((membership) => `${membership.user_id}:${membership.role}`));
    const missing = sourceMemberships.rows.filter((membership) => !existing.has(`${membership.user_id}:${membership.role}`));

    if (APPLY) {
      for (const membership of missing) {
        await client.query(
          `insert into public.restaurant_memberships (user_id, restaurant_id, role)
           values ($1, $2, $3)`,
          [membership.user_id, targetRestaurantId, membership.role],
        );
      }
    }

    return { copied: missing.length, total: sourceMemberships.rows.length };
  });
}

async function importMenuItems(restaurantId: string, items: MenuItemUpsertInput[]) {
  if (!APPLY) {
    return {
      applied: false,
      plannedItemCount: items.length,
    };
  }

  const rpcResult = await supabase.rpc('import_restaurant_menu_bundle', {
    p_restaurant_id: restaurantId,
    p_items: items,
    p_modifier_groups: [],
    p_modifier_options: [],
    p_replace_modifiers: false,
  });

  if (!rpcResult.error) {
    return {
      applied: true,
      mode: 'rpc',
      result: rpcResult.data,
      itemCount: items.length,
    };
  }

  return withPgClient(async (client) => {
    await client.query('begin');
    try {
      for (const item of items) {
        await client.query(
          `
            insert into public.restaurant_menu_items (
              restaurant_id,
              external_item_id,
              item_name,
              category,
              subcategory,
              short_description,
              full_description,
              base_price,
              currency,
              service_time,
              availability_status,
              key_ingredients,
              main_protein_or_base,
              cooking_style,
              preparation_method,
              flavor_profile,
              texture,
              spice_level,
              spice_adjustable,
              portion_size,
              shareable,
              recommendation_tags,
              pairings,
              signature_score,
              popularity_score,
              dietary_tags,
              allergens_contains,
              allergens_may_contain,
              removable_ingredients,
              substitutions_allowed,
              can_be_made_vegetarian,
              can_be_made_vegan,
              can_be_made_gluten_free,
              customization_rules,
              serving_notes,
              active,
              seasonal,
              limited_time,
              sold_out,
              display_order,
              image_url
            )
            values (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
              $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41
            )
            on conflict (restaurant_id, external_item_id)
            do update set
              item_name = excluded.item_name,
              category = excluded.category,
              subcategory = excluded.subcategory,
              short_description = excluded.short_description,
              full_description = excluded.full_description,
              base_price = excluded.base_price,
              currency = excluded.currency,
              service_time = excluded.service_time,
              availability_status = excluded.availability_status,
              key_ingredients = excluded.key_ingredients,
              main_protein_or_base = excluded.main_protein_or_base,
              cooking_style = excluded.cooking_style,
              preparation_method = excluded.preparation_method,
              flavor_profile = excluded.flavor_profile,
              texture = excluded.texture,
              spice_level = excluded.spice_level,
              spice_adjustable = excluded.spice_adjustable,
              portion_size = excluded.portion_size,
              shareable = excluded.shareable,
              recommendation_tags = excluded.recommendation_tags,
              pairings = excluded.pairings,
              signature_score = excluded.signature_score,
              popularity_score = excluded.popularity_score,
              dietary_tags = excluded.dietary_tags,
              allergens_contains = excluded.allergens_contains,
              allergens_may_contain = excluded.allergens_may_contain,
              removable_ingredients = excluded.removable_ingredients,
              substitutions_allowed = excluded.substitutions_allowed,
              can_be_made_vegetarian = excluded.can_be_made_vegetarian,
              can_be_made_vegan = excluded.can_be_made_vegan,
              can_be_made_gluten_free = excluded.can_be_made_gluten_free,
              customization_rules = excluded.customization_rules,
              serving_notes = excluded.serving_notes,
              active = excluded.active,
              seasonal = excluded.seasonal,
              limited_time = excluded.limited_time,
              sold_out = excluded.sold_out,
              display_order = excluded.display_order,
              image_url = excluded.image_url
          `,
          [
            restaurantId,
            item.externalItemId,
            item.itemName,
            item.category,
            item.subcategory,
            item.shortDescription,
            item.fullDescription,
            item.basePrice,
            item.currency,
            item.serviceTime,
            item.availabilityStatus,
            item.keyIngredients,
            item.mainProteinOrBase,
            item.cookingStyle,
            item.preparationMethod,
            item.flavorProfile,
            item.texture,
            item.spiceLevel,
            item.spiceAdjustable,
            item.portionSize,
            item.shareable,
            item.recommendationTags,
            item.pairings,
            item.signatureScore,
            item.popularityScore,
            item.dietaryTags,
            item.allergensContains,
            item.allergensMayContain,
            item.removableIngredients,
            item.substitutionsAllowed,
            item.canBeMadeVegetarian,
            item.canBeMadeVegan,
            item.canBeMadeGlutenFree,
            item.customizationRules,
            item.servingNotes,
            item.active,
            item.seasonal,
            item.limitedTime,
            item.soldOut,
            item.displayOrder,
            item.imageUrl,
          ],
        );
      }

      await client.query('commit');
      return {
        applied: true,
        mode: 'pg-upsert-fallback',
        fallbackError: rpcResult.error.message,
        itemCount: items.length,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

async function readBackSummary(restaurantId: string) {
  return withPgClient(async (client) => {
    const [restaurant, memberships, menuItems] = await Promise.all([
      client.query(
        `select id, name, slug, timezone, address, contact_email, contact_phone
         from public.restaurants
         where id = $1`,
        [restaurantId],
      ),
      client.query(
        `select user_id, role
         from public.restaurant_memberships
         where restaurant_id = $1
         order by role, user_id`,
        [restaurantId],
      ),
      client.query(
        `select id, external_item_id, item_name, category, subcategory, base_price, currency, display_order
         from public.restaurant_menu_items
         where restaurant_id = $1
         order by display_order asc, item_name asc`,
        [restaurantId],
      ),
    ]);

    return {
      restaurant: restaurant.rows[0] ?? null,
      memberships: memberships.rows,
      menuItemCount: menuItems.rows.length,
      firstTenItems: menuItems.rows.slice(0, 10),
    };
  });
}

async function main() {
  const payload = await loadSourcePayload();
  const sourceRestaurant = await loadSourceRestaurant();
  const externalIds = buildExternalIds(payload.items);
  const items = payload.items.map((row, index) => normalizeItem(row, externalIds[index]!, index));

  writeJsonArtifact('source-summary.json', {
    venue: payload.venue,
    generatedOn: payload.generatedOn,
    itemCount: payload.items.length,
    notes: payload.notes ?? [],
  });
  writeJsonArtifact('normalized-menu-items.json', items);

  const targetRestaurant = await ensureTargetRestaurant(sourceRestaurant);
  const membershipSummary =
    targetRestaurant.restaurantId === 'dry-run-target-restaurant'
      ? { copied: 0, total: 0 }
      : await ensureMemberships(sourceRestaurant.id, targetRestaurant.restaurantId);

  const importResult =
    targetRestaurant.restaurantId === 'dry-run-target-restaurant'
      ? { applied: false, plannedItemCount: items.length }
      : await importMenuItems(targetRestaurant.restaurantId, items);

  const verification =
    targetRestaurant.restaurantId === 'dry-run-target-restaurant'
      ? null
      : await readBackSummary(targetRestaurant.restaurantId);

  const summary = {
    apply: APPLY,
    sourceRestaurantSlug: SOURCE_RESTAURANT_SLUG,
    targetRestaurantSlug: TARGET_SLUG,
    targetRestaurantId: targetRestaurant.restaurantId,
    targetRestaurantExisted: targetRestaurant.existed,
    membershipSummary,
    itemCount: items.length,
    importResult,
    verification,
  };

  writeJsonArtifact('import-summary.json', summary);

  if (verification) {
    writeJsonArtifact('readback-verification.json', verification);
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
