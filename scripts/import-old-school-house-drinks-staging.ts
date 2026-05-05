import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

import { DrinkItemUpsertInputSchema, type DrinkItemUpsertInput } from '../server/drinks-menu/types';
import { getPgSslConfig } from './db/pg-ssl';
import { loadWindowAssignedObjectLiteral } from './menu/source-literal';

type SourceBadge = {
  text?: string;
  tone?: string;
};

type SourceItem = {
  name: string;
  price?: string;
  price2?: string;
  price3?: string;
  note?: string;
  detail?: string;
  starred?: boolean;
  badge?: SourceBadge;
};

type SourceSection = {
  title: string;
  measure?: string;
  items: SourceItem[];
};

type SourcePanel = {
  title: string;
  note?: string;
  sections: SourceSection[];
};

type SourceColumn = {
  panels: SourcePanel[];
};

type SourcePage = {
  id: string;
  title: string;
  subtitle?: string;
  columns: SourceColumn[];
};

type SourcePayload = {
  venue: {
    name: string;
    subtitle?: string;
    phone?: string;
    address?: string;
    website?: string;
    socialHandle?: string;
  };
  footerNote?: string;
  pages: SourcePage[];
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

type FlattenedEntry = {
  pageId: string;
  pageTitle: string;
  pageSubtitle: string | null;
  panelTitle: string;
  panelNote: string | null;
  sectionTitle: string;
  measure: string | null;
  item: SourceItem;
  displayOrder: number;
};

type ModifierGroupPayload = {
  externalModifierGroupId: string;
  externalDrinkId: string;
  groupName: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
};

type ModifierOptionPayload = {
  externalModifierOptionId: string;
  externalModifierGroupId: string;
  optionName: string;
  priceDelta: number;
  defaultSelected: boolean;
  availabilityStatus: 'available' | 'unavailable';
  displayOrder: number;
};

type Classification = {
  category: string;
  subcategory: string;
  drinkType: string;
  alcoholic: boolean;
  servedStyle: string | null;
  temperature: string | null;
  baseSpirit: string | null;
  beerStyle: string | null;
  wineType: string | null;
  grapeVarietal: string | null;
  region: string | null;
  country: string | null;
  roastLevel: string | null;
  caffeineLevel: string | null;
  sweetnessLevel: string | null;
  bitternessLevel: string | null;
  acidityLevel: string | null;
  bodyLevel: string | null;
  flavorProfile: string | null;
  keyIngredients: string[];
  garnish: string | null;
  containsDairy: boolean;
  containsNuts: boolean;
  containsGluten: boolean;
  containsCaffeine: boolean;
  dietaryTags: string[];
  allergensContains: string[];
  allergensMayContain: string[];
  canBeMadeNonAlcoholic: boolean;
  canBeMadeDecaf: boolean;
  pairings: string[];
  recommendationTags: string[];
  signatureScore: number | null;
  popularityScore: number | null;
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
const SOURCE_JS_PATH =
  process.env.SOURCE_JS_PATH?.trim() ||
  '/Users/amankumarshrestha/LapenInns Project/Menu/theoldschoolhousemenu-standalone/drinks-menu-data.js';
const TASK_DIR =
  process.env.TASK_DIR?.trim() ||
  path.join(projectRoot, 'tasks', 'drink-menu-staging-import-20260418-0912');
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
    ssl: getPgSslConfig(),
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
    .replace(/[^\w\s/-]+/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/-+/g, '-');
}

function compact<T>(values: Array<T | null | undefined | false>): T[] {
  return values.filter(Boolean) as T[];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractNumericPrice(value: string | undefined): number | null {
  const parsed = Number.parseFloat(value?.trim() ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function titleCase(value: string): string {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeText(value: string | undefined | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function cleanDrinkName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function parseMeasureOptions(
  entry: FlattenedEntry,
): Array<{ label: string; price: number; volumeMl: number | null }> {
  const base = extractNumericPrice(entry.item.price);
  const second = extractNumericPrice(entry.item.price2);
  const third = extractNumericPrice(entry.item.price3);
  const measure = (entry.measure ?? '').toLowerCase();

  if (base === null) return [];

  if (measure.includes('175ml') && measure.includes('250ml') && third !== null) {
    return [
      { label: '175ml', price: base, volumeMl: 175 },
      { label: '250ml', price: second ?? base, volumeMl: 250 },
      { label: 'Bottle', price: third, volumeMl: 750 },
    ];
  }

  if (measure.includes('175ml') && measure.includes('250ml') && second !== null) {
    return [
      { label: '175ml', price: base, volumeMl: 175 },
      { label: '250ml', price: second, volumeMl: 250 },
    ];
  }

  if (measure.includes('25ml') && measure.includes('50ml') && second !== null) {
    return [
      { label: '25ml', price: base, volumeMl: 25 },
      { label: '50ml', price: second, volumeMl: 50 },
    ];
  }

  if (measure.includes('small') && measure.includes('large') && second !== null) {
    return [
      { label: 'Small', price: base, volumeMl: null },
      { label: 'Large', price: second, volumeMl: null },
    ];
  }

  return [];
}

function inferVolumeMl(
  entry: FlattenedEntry,
  measureOptions: Array<{ volumeMl: number | null }>,
): number | null {
  if (measureOptions.length > 0) {
    return measureOptions[0]?.volumeMl ?? null;
  }

  const measure = (entry.measure ?? '').toLowerCase();
  if (measure.includes('pint')) return 568;
  if (measure.includes('half pint')) return 284;
  return null;
}

function inferServingSize(
  entry: FlattenedEntry,
  measureOptions: Array<{ label: string }>,
): string | null {
  if (measureOptions.length > 0) {
    return measureOptions[0]?.label ?? null;
  }

  const measure = normalizeText(entry.measure);
  if (!measure) return null;
  return measure.replace(/·/g, '/');
}

function inferDrinkTypeForSoft(name: string): string {
  const key = name.toLowerCase();
  if (key.includes('juice')) return 'juice';
  if (key.includes('water')) return 'water';
  if (
    key.includes('cola') ||
    key.includes('coke') ||
    key.includes('fanta') ||
    key.includes('lemonade')
  )
    return 'soda';
  return 'soft_drink';
}

function inferBeerStyle(name: string, entry: FlattenedEntry): string | null {
  const key = `${name} ${entry.item.note ?? ''}`.toLowerCase();
  if (key.includes('guinness')) return 'stout';
  if (key.includes('ipa')) return 'ipa';
  if (key.includes('cask') || key.includes('landlord')) return 'cask ale';
  if (key.includes('newcastle brown')) return 'brown ale';
  if (key.includes('desperados')) return 'tequila lager';
  if (
    key.includes('cider') ||
    key.includes("inch's") ||
    key.includes('kopparberg') ||
    key.includes('rekorderlig') ||
    key.includes('magners') ||
    key.includes('bulmers') ||
    key.includes('old mout')
  ) {
    return 'cider';
  }
  return 'lager';
}

function inferWineType(entry: FlattenedEntry): string | null {
  const key = `${entry.pageTitle} ${entry.sectionTitle}`.toLowerCase();
  if (key.includes('sparkling') || key.includes('champagne')) return 'sparkling';
  if (key.includes('white')) return 'white';
  if (key.includes('rose')) return 'rose';
  if (key.includes('red')) return 'red';
  if (key.includes('sherry') || key.includes('port')) return 'fortified';
  return null;
}

function inferGrapeVarietal(name: string): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/pinot grigio/i, 'Pinot Grigio'],
    [/chenin blanc/i, 'Chenin Blanc'],
    [/viognier/i, 'Viognier'],
    [/sauvignon blanc/i, 'Sauvignon Blanc'],
    [/riesling/i, 'Riesling'],
    [/chardonnay/i, 'Chardonnay'],
    [/pecorino/i, 'Pecorino'],
    [/picpoul/i, 'Picpoul'],
    [/garnacha/i, 'Garnacha'],
    [/tempranillo/i, 'Tempranillo'],
    [/pinot noir/i, 'Pinot Noir'],
    [/merlot/i, 'Merlot'],
    [/malbec/i, 'Malbec'],
    [/negroamaro/i, 'Negroamaro'],
    [/shiraz/i, 'Shiraz'],
    [/rioja/i, 'Tempranillo'],
  ];

  for (const [pattern, varietal] of patterns) {
    if (pattern.test(name)) {
      return varietal;
    }
  }

  return null;
}

function inferRegionCountry(
  name: string,
  entry: FlattenedEntry,
): { region: string | null; country: string | null } {
  const key = `${name} ${entry.pageTitle} ${entry.sectionTitle}`.toLowerCase();
  const hints: Array<[RegExp, string, string]> = [
    [/marlborough/i, 'Marlborough', 'New Zealand'],
    [/loire/i, 'Loire Valley', 'France'],
    [/chablis/i, 'Chablis', 'France'],
    [/sancerre/i, 'Loire Valley', 'France'],
    [/bourgogne/i, 'Burgundy', 'France'],
    [/beaujolais/i, 'Beaujolais', 'France'],
    [/saint-emilion/i, 'Saint-Emilion', 'France'],
    [/gigondas/i, 'Rhone Valley', 'France'],
    [/provence/i, 'Provence', 'France'],
    [/picpoul de pinet/i, 'Languedoc', 'France'],
    [/salento/i, 'Puglia', 'Italy'],
    [/terre di chieti/i, 'Abruzzo', 'Italy'],
    [/vinho verde/i, 'Vinho Verde', 'Portugal'],
    [/vidigal/i, 'Lisbon', 'Portugal'],
    [/rioja/i, 'Rioja', 'Spain'],
    [/garnacha|tempranillo/i, 'Spain', 'Spain'],
    [/guinness/i, 'Dublin', 'Ireland'],
    [/birra moretti|peroni/i, 'Italy', 'Italy'],
    [/stella artois/i, 'Belgium', 'Belgium'],
    [/cruzcampo|estrella/i, 'Spain', 'Spain'],
    [
      /landlord|newcastle brown|beefeater|whitley neill|jj whitley|smirnoff|gordon|tanqueray|bombay sapphire|hendrick|the botanist|brewdog/i,
      'United Kingdom',
      'United Kingdom',
    ],
    [/amstel|heineken/i, 'Netherlands', 'Netherlands'],
    [/sol/i, 'Mexico', 'Mexico'],
    [/singha/i, 'Thailand', 'Thailand'],
    [/cobra/i, 'India', 'India'],
    [/kopparberg|rekorderlig|absolut/i, 'Sweden', 'Sweden'],
    [/magners|jameson|bushmills/i, 'Ireland', 'Ireland'],
    [/ciroc|courvoisier|martell|remy martin|three barrels/i, 'France', 'France'],
    [/malfy/i, 'Italy', 'Italy'],
  ];

  for (const [pattern, region, country] of hints) {
    if (pattern.test(key)) {
      return { region, country };
    }
  }

  return { region: null, country: null };
}

function inferAbv(name: string, classification: Classification): number | null {
  const key = name.toLowerCase();
  const overrides: Array<[RegExp, number]> = [
    [/guinness zero|heineken 0\.0/i, 0],
    [/lucky saint|peroni \(af\)/i, 0.5],
    [/guinness/i, 4.2],
    [/birra moretti/i, 4.6],
    [/stella artois/i, 4.6],
    [/cruzcampo/i, 4.4],
    [/estrella/i, 4.6],
    [/landlord/i, 4.3],
    [/amstel/i, 4.1],
    [/peroni/i, 5.1],
    [/desperados/i, 5.9],
    [/budweiser/i, 4.5],
    [/sol/i, 4.2],
    [/singha/i, 5],
    [/heineken/i, 5],
    [/cobra/i, 4.5],
    [/newcastle brown/i, 4.7],
    [/punk ipa/i, 5.4],
    [/kopparberg|rekorderlig|old mout|magners|bulmers/i, 4],
    [
      /au vodka|smirnoff rasp\. crush|absolut raspberri|absolut vanilla|smirnoff mango|glen's vodka/i,
      37.5,
    ],
    [/ciroc/i, 40],
    [/absolut/i, 40],
    [/jj whitley/i, 38],
    [/smirnoff$/i, 37.5],
    [/hendrick|the botanist|tanqueray|bombay sapphire|whitley neill|malfy|beefeater|gordon/i, 37.5],
    [/kraken/i, 40],
    [/dead man's fingers|bacardi|captain morgan|malibu/i, 37.5],
    [/glenfiddich|glenmorangie/i, 40],
    [/glenlivet|jameson|bushmills/i, 40],
    [/courvoisier|martell|three barrels/i, 40],
    [/remy martin/i, 40],
    [/delour napoleon/i, 36],
    [/archers|tia maria|baileys|disaronno|martini|sourz/i, 20],
    [/jagermeister/i, 35],
    [/sambuca/i, 38],
    [/tequila/i, 38],
    [/harvey's solera/i, 17.5],
    [/taylor's ruby port/i, 20],
    [/vk|smirnoff ice/i, 4],
    [/espresso martini|long island iced tea/i, 16],
    [/margarita|cosmopolitan|bramble|pornstar martini|strawberry daiquiri|pina colada|mojito/i, 14],
  ];

  for (const [pattern, value] of overrides) {
    if (pattern.test(key)) {
      return value;
    }
  }

  switch (classification.drinkType) {
    case 'beer':
      return classification.beerStyle === 'stout' ? 4.2 : 4.5;
    case 'cider':
      return classification.alcoholic ? 4 : 0.5;
    case 'wine':
      return classification.wineType === 'sparkling' ? 11.5 : 12.5;
    case 'fortified_wine':
      return 19;
    case 'cocktail':
      return classification.alcoholic ? 14 : 0;
    case 'spirit':
    case 'liqueur':
      return classification.alcoholic ? 37.5 : 0;
    case 'rtd':
      return 4;
    default:
      return classification.alcoholic ? 4 : null;
  }
}

function inferCocktailBaseSpirit(name: string): string | null {
  const key = name.toLowerCase();
  if (key.includes('margarita')) return 'Tequila';
  if (key.includes('mojito') || key.includes('daiquiri') || key.includes('pina colada'))
    return 'Rum';
  if (key.includes('bramble')) return 'Gin';
  if (
    key.includes('espresso martini') ||
    key.includes('pornstar martini') ||
    key.includes('cosmopolitan') ||
    key.includes('sex on the beach')
  ) {
    return 'Vodka';
  }
  if (key.includes('long island')) return 'Mixed';
  return null;
}

function inferFlavorProfile(
  name: string,
  entry: FlattenedEntry,
  drinkType: string,
  beerStyle: string | null,
  wineType: string | null,
): string | null {
  const key = `${name} ${entry.sectionTitle}`.toLowerCase();

  if (key.includes('guinness')) return 'dark roast, creamy, cocoa';
  if (key.includes('cider')) return 'orchard fruit, crisp, lightly sweet';
  if (beerStyle === 'ipa') return 'hoppy, citrus, bitter';
  if (beerStyle === 'lager') return 'crisp, clean, refreshing';
  if (beerStyle === 'stout') return 'roasted malt, chocolate, smooth';
  if (wineType === 'sparkling') return 'bright citrus, orchard fruit, lively bubbles';
  if (wineType === 'white' && entry.sectionTitle.toLowerCase().includes('fresh'))
    return 'zesty citrus, green apple, mineral';
  if (wineType === 'white' && entry.sectionTitle.toLowerCase().includes('aromatic'))
    return 'stone fruit, blossom, expressive aromatics';
  if (wineType === 'rose') return 'red berry, crisp, floral';
  if (wineType === 'red' && entry.sectionTitle.toLowerCase().includes('fruity'))
    return 'soft red fruit, bright, easy-drinking';
  if (wineType === 'red' && entry.sectionTitle.toLowerCase().includes('juicy'))
    return 'ripe dark fruit, spice, rounded tannin';
  if (drinkType === 'cocktail') {
    if (key.includes('espresso martini')) return 'coffee, cocoa, silky';
    if (key.includes('pornstar')) return 'passion fruit, vanilla, tropical';
    if (key.includes('margarita')) return 'citrus, sharp, saline';
    if (key.includes('mojito')) return 'mint, lime, refreshing';
    if (key.includes('pina colada')) return 'pineapple, coconut, creamy';
    return 'balanced, bar-made, easy-sipping';
  }
  if (drinkType === 'tea') return 'fragrant, warming, delicate tannin';
  if (drinkType === 'coffee') return 'roasted, warming, bittersweet';
  if (drinkType === 'juice') return 'fruit-forward, refreshing';
  if (drinkType === 'soft_drink' || drinkType === 'soda') return 'light, refreshing';

  return null;
}

function inferPairings(classification: Classification): string[] {
  switch (classification.category) {
    case 'Beer & Cider':
      return classification.drinkType === 'cider'
        ? ['pork dishes', 'roast chicken', 'garden salads']
        : ['burgers', 'fish and chips', 'pub classics'];
    case 'Wine':
      if (classification.wineType === 'white' || classification.wineType === 'sparkling') {
        return ['seafood', 'roast chicken', 'lighter starters'];
      }
      if (classification.wineType === 'rose') {
        return ['small plates', 'summer salads', 'grilled chicken'];
      }
      return ['steaks', 'lamb dishes', 'rich mains'];
    case 'Cocktails':
      return ['small plates', 'desserts', 'late-evening tables'];
    case 'Spirits':
      return ['after dinner', 'cheese boards', 'slow sips'];
    case 'No & Low':
      return ['lunch service', 'drivers', 'lighter dishes'];
    case 'Soft Drinks':
      return ['family dining', 'lunch service'];
    case 'Hot Drinks':
      return ['desserts', 'after dinner'];
    case 'Ready to Drink':
      return ['casual rounds', 'bar snacks'];
    default:
      return [];
  }
}

function inferScores(
  entry: FlattenedEntry,
  classification: Classification,
): { signatureScore: number | null; popularityScore: number | null } {
  let signature =
    classification.category === 'Wine' ? 56 : classification.category === 'Cocktails' ? 62 : 50;
  let popularity =
    classification.category === 'Beer & Cider'
      ? 68
      : classification.category === 'Cocktails'
        ? 74
        : 60;

  if (entry.item.starred) {
    signature += 18;
    popularity += 10;
  }

  const badge = entry.item.badge?.text?.toLowerCase() ?? '';
  if (badge.includes('signature') || badge.includes('house')) signature += 10;
  if (badge.includes('popular') || badge.includes('most ordered') || badge.includes('staff'))
    popularity += 10;
  if (badge.includes('classic')) popularity += 6;

  const key = entry.item.name.toLowerCase();
  if (/guinness|pornstar martini|espresso martini|malbec|hendrick|prosecco/i.test(key)) {
    popularity += 6;
  }

  return {
    signatureScore: Math.min(signature, 95),
    popularityScore: Math.min(popularity, 96),
  };
}

function inferRecommendationTags(entry: FlattenedEntry, classification: Classification): string[] {
  const badge = entry.item.badge?.text?.toLowerCase() ?? '';
  return dedupe(
    compact([
      classification.drinkType,
      slugify(classification.subcategory),
      entry.item.starred ? 'featured' : null,
      badge.includes('house') ? 'house-pick' : null,
      badge.includes('popular') || badge.includes('most ordered') ? 'popular' : null,
      badge.includes('signature') ? 'signature' : null,
      classification.category === 'No & Low' ? 'low-and-no' : null,
      classification.category === 'Hot Drinks' ? 'after-dinner' : null,
    ]),
  );
}

function inferClassification(entry: FlattenedEntry): Classification {
  const name = cleanDrinkName(entry.item.name);
  const sectionKey = entry.sectionTitle.toLowerCase();
  const pageKey = entry.pageTitle.toLowerCase();
  const fullKey = `${name} ${sectionKey} ${pageKey}`.toLowerCase();

  let category = 'Drinks';
  let subcategory = titleCase(entry.sectionTitle);
  let drinkType = 'drink';
  let alcoholic = true;
  let servedStyle: string | null = null;
  let temperature: string | null = null;
  let baseSpirit: string | null = null;
  let beerStyle: string | null = null;
  let wineType: string | null = null;
  let roastLevel: string | null = null;
  let caffeineLevel: string | null = null;
  let sweetnessLevel: string | null = null;
  let bitternessLevel: string | null = null;
  let acidityLevel: string | null = null;
  let bodyLevel: string | null = null;
  let garnish: string | null = null;
  let containsDairy = false;
  let containsNuts = false;
  let containsGluten = false;
  let containsCaffeine = false;
  let dietaryTags: string[] = [];
  let allergensContains: string[] = [];
  let allergensMayContain: string[] = [];
  let canBeMadeNonAlcoholic = false;
  let canBeMadeDecaf = false;

  if (
    sectionKey.includes('draught') ||
    sectionKey.includes('bottled beer') ||
    sectionKey.includes('bottled cider')
  ) {
    category = 'Beer & Cider';
    const itemBeerStyle = inferBeerStyle(name, entry);
    const isCider = itemBeerStyle === 'cider';
    subcategory = isCider
      ? sectionKey.includes('draught')
        ? 'Draught Cider'
        : 'Bottled Cider'
      : sectionKey.includes('draught')
        ? 'Draught Beer'
        : 'Bottled Beer';
    drinkType = isCider ? 'cider' : 'beer';
    alcoholic = !/0\.0|zero|af|alcohol free/i.test(fullKey);
    servedStyle = sectionKey.includes('draught') ? 'Draught' : 'Bottle';
    temperature = 'Chilled';
    beerStyle = itemBeerStyle;
    sweetnessLevel = drinkType === 'cider' ? 'medium' : 'low';
    bitternessLevel = beerStyle === 'ipa' ? 'high' : beerStyle === 'stout' ? 'medium' : 'low';
    acidityLevel = drinkType === 'cider' ? 'medium' : 'low';
    bodyLevel = beerStyle === 'stout' ? 'full' : 'light';
    containsGluten = drinkType === 'beer' && !/gf/i.test(fullKey) && !/0\.0/i.test(fullKey);
    dietaryTags = compact([
      /gf/i.test(fullKey) ? 'gluten-free' : null,
      !alcoholic ? 'non-alcoholic' : null,
    ]);
  } else if (sectionKey.includes('no & low')) {
    category = 'No & Low';
    subcategory = /old mout/i.test(fullKey) ? 'Low & No Cider' : 'Low & No Beer';
    drinkType = /old mout/i.test(fullKey) ? 'cider' : 'beer';
    alcoholic = /old mout/i.test(fullKey) ? true : false;
    servedStyle = /lucky saint/i.test(fullKey) ? 'Draught' : 'Bottle';
    temperature = 'Chilled';
    beerStyle = drinkType === 'beer' ? inferBeerStyle(name, entry) : 'cider';
    sweetnessLevel = drinkType === 'cider' ? 'medium' : 'low';
    bitternessLevel = drinkType === 'beer' ? 'low' : 'low';
    acidityLevel = drinkType === 'cider' ? 'medium' : 'low';
    bodyLevel = 'light';
    dietaryTags = alcoholic ? [] : ['non-alcoholic'];
    containsGluten = drinkType === 'beer' && !/peroni \(af\)|0\.0/i.test(fullKey);
  } else if (
    sectionKey.includes('vodka') ||
    sectionKey.includes('gin') ||
    sectionKey.includes('rum') ||
    sectionKey.includes('whisky') ||
    sectionKey.includes('brandy')
  ) {
    category = 'Spirits';
    subcategory = titleCase(entry.sectionTitle);
    drinkType = 'spirit';
    servedStyle = 'Neat or mixed';
    temperature = 'Ambient';
    baseSpirit = titleCase(entry.sectionTitle);
    sweetnessLevel = sectionKey.includes('rum') ? 'medium' : 'low';
    bitternessLevel = 'low';
    acidityLevel = 'low';
    bodyLevel = 'medium';
    dietaryTags = ['gluten-free'];
    canBeMadeNonAlcoholic = false;
  } else if (sectionKey.includes('liqueurs') || sectionKey.includes('shots')) {
    category = 'Spirits';
    subcategory = 'Liqueurs & Shots';
    drinkType = /tequila/i.test(fullKey) ? 'spirit' : 'liqueur';
    servedStyle = 'Shot or pour';
    temperature = 'Ambient';
    sweetnessLevel = /jager|sambuca|tequila/i.test(fullKey) ? 'low' : 'medium';
    bitternessLevel = /tia maria/i.test(fullKey) ? 'medium' : 'low';
    acidityLevel = 'low';
    bodyLevel = 'medium';
    containsDairy = /baileys/i.test(fullKey);
    containsCaffeine = /tia maria/i.test(fullKey);
    containsNuts = /disaronno/i.test(fullKey);
    dietaryTags = ['gluten-free'];
  } else if (
    pageKey.includes('wine') ||
    pageKey.includes('sparkling') ||
    pageKey.includes('white') ||
    pageKey.includes('red') ||
    pageKey.includes('rose') ||
    sectionKey.includes('sparkling') ||
    sectionKey.includes('red') ||
    sectionKey.includes('white') ||
    sectionKey.includes('rose') ||
    sectionKey.includes('sherry') ||
    sectionKey.includes('port')
  ) {
    category = 'Wine';
    wineType = inferWineType(entry);
    subcategory =
      wineType === 'sparkling'
        ? 'Sparkling Wine'
        : wineType === 'white'
          ? 'White Wine'
          : wineType === 'rose'
            ? 'Rose Wine'
            : wineType === 'red'
              ? 'Red Wine'
              : 'Fortified Wine';
    drinkType = wineType === 'fortified' ? 'fortified_wine' : 'wine';
    alcoholic = true;
    servedStyle =
      entry.measure?.toLowerCase().includes('bottle') &&
      !entry.measure?.toLowerCase().includes('175ml')
        ? 'Bottle'
        : 'By the glass';
    temperature = wineType === 'red' || wineType === 'fortified' ? 'Cellar cool' : 'Chilled';
    sweetnessLevel = wineType === 'rose' ? 'medium' : wineType === 'fortified' ? 'sweet' : 'low';
    bitternessLevel = 'low';
    acidityLevel = wineType === 'white' || wineType === 'sparkling' ? 'high' : 'medium';
    bodyLevel =
      wineType === 'sparkling'
        ? 'light'
        : wineType === 'white'
          ? entry.sectionTitle.toLowerCase().includes('aromatic')
            ? 'medium'
            : 'light'
          : wineType === 'red'
            ? entry.sectionTitle.toLowerCase().includes('juicy')
              ? 'medium-full'
              : 'medium'
            : 'medium';
    allergensContains = ['sulphites'];
    dietaryTags = [];
  } else if (sectionKey.includes('cocktail')) {
    category = 'Cocktails';
    subcategory = 'House Cocktails';
    drinkType = 'cocktail';
    alcoholic = true;
    servedStyle = 'Cocktail';
    temperature = 'Chilled';
    baseSpirit = inferCocktailBaseSpirit(name);
    sweetnessLevel = /margarita|bramble|espresso/i.test(fullKey) ? 'medium-low' : 'medium';
    bitternessLevel = /espresso|long island/i.test(fullKey) ? 'medium' : 'low';
    acidityLevel = /margarita|cosmopolitan|mojito|daiquiri|bramble/i.test(fullKey)
      ? 'high'
      : 'medium';
    bodyLevel = /pina colada|espresso/i.test(fullKey) ? 'medium-full' : 'medium';
    garnish = /margarita/i.test(fullKey)
      ? 'Lime wedge'
      : /mojito/i.test(fullKey)
        ? 'Mint sprig'
        : /espresso/i.test(fullKey)
          ? 'Coffee beans'
          : /pornstar/i.test(fullKey)
            ? 'Passion fruit half'
            : null;
    containsCaffeine = /espresso/i.test(fullKey);
    canBeMadeNonAlcoholic = /daiquiri|pornstar|mojito|pina colada|cosmopolitan|bramble/i.test(
      fullKey,
    );
  } else if (sectionKey.includes('rtd')) {
    category = 'Ready to Drink';
    subcategory = 'RTD Bottles';
    drinkType = 'rtd';
    alcoholic = true;
    servedStyle = 'Bottle';
    temperature = 'Chilled';
    sweetnessLevel = 'high';
    bitternessLevel = 'low';
    acidityLevel = 'medium';
    bodyLevel = 'light';
  } else if (sectionKey.includes('soft drink')) {
    category = 'Soft Drinks';
    subcategory = 'Soft Drinks';
    drinkType = inferDrinkTypeForSoft(name);
    alcoholic = false;
    servedStyle = 'Glass pour';
    temperature = 'Cold';
    sweetnessLevel = /water/i.test(fullKey) ? 'low' : 'medium';
    bitternessLevel = /coke|cola|diet/i.test(fullKey) ? 'medium-low' : 'low';
    acidityLevel = /juice|cola|fanta/i.test(fullKey) ? 'medium' : 'low';
    bodyLevel = 'light';
    containsCaffeine = /coke|cola/i.test(fullKey);
    dietaryTags = compact([drinkType === 'water' || drinkType === 'juice' ? 'vegan' : null]);
  } else if (sectionKey.includes('hot drinks')) {
    category = 'Hot Drinks';
    subcategory = /tea/i.test(fullKey) ? 'Tea' : 'Coffee & Chocolate';
    drinkType = /tea/i.test(fullKey) ? 'tea' : /coffee/i.test(fullKey) ? 'coffee' : 'hot_chocolate';
    alcoholic = false;
    servedStyle = 'Cup';
    temperature = 'Hot';
    roastLevel = drinkType === 'coffee' ? 'medium' : null;
    caffeineLevel = /tea/i.test(fullKey) ? 'medium' : /coffee/i.test(fullKey) ? 'high' : 'low';
    sweetnessLevel = /chocolate/i.test(fullKey) ? 'high' : 'low';
    bitternessLevel = /coffee/i.test(fullKey) ? 'medium' : 'low';
    acidityLevel = /coffee/i.test(fullKey) ? 'medium' : 'low';
    bodyLevel = /hot chocolate/i.test(fullKey) ? 'medium-full' : 'medium';
    containsCaffeine = drinkType === 'tea' || drinkType === 'coffee';
    containsDairy = /hot chocolate/i.test(fullKey);
    canBeMadeDecaf = /tea|coffee/i.test(fullKey);
    dietaryTags = compact([!containsDairy ? 'vegetarian' : null]);
  }

  const { region, country } = inferRegionCountry(name, entry);
  const grapeVarietal =
    drinkType === 'wine' || drinkType === 'fortified_wine' ? inferGrapeVarietal(name) : null;
  const flavorProfile = inferFlavorProfile(name, entry, drinkType, beerStyle, wineType);
  const keyIngredients = dedupe(
    compact([
      drinkType === 'beer' ? 'malted barley' : null,
      drinkType === 'beer' ? 'hops' : null,
      drinkType === 'cider' ? 'apples' : null,
      drinkType === 'cocktail' && baseSpirit ? baseSpirit.toLowerCase() : null,
      drinkType === 'tea' ? 'tea leaves' : null,
      drinkType === 'coffee' ? 'coffee beans' : null,
      drinkType === 'hot_chocolate' ? 'cocoa' : null,
      drinkType === 'juice' && /orange/i.test(fullKey) ? 'orange juice' : null,
      drinkType === 'juice' && /apple/i.test(fullKey) ? 'apple juice' : null,
      drinkType === 'wine' && grapeVarietal ? grapeVarietal : null,
      drinkType === 'spirit' && baseSpirit ? baseSpirit.toLowerCase() : null,
    ]),
  );

  if (containsGluten) {
    allergensContains = dedupe([...allergensContains, 'gluten']);
  }
  if (containsDairy) {
    allergensContains = dedupe([...allergensContains, 'milk']);
  }
  if (containsNuts) {
    allergensMayContain = dedupe([...allergensMayContain, 'nuts']);
  }

  if (drinkType === 'spirit' || drinkType === 'liqueur') {
    allergensContains = dedupe(allergensContains);
  }

  const pairings = inferPairings({
    category,
    subcategory,
    drinkType,
    alcoholic,
    servedStyle,
    temperature,
    baseSpirit,
    beerStyle,
    wineType,
    grapeVarietal,
    region,
    country,
    roastLevel,
    caffeineLevel,
    sweetnessLevel,
    bitternessLevel,
    acidityLevel,
    bodyLevel,
    flavorProfile,
    keyIngredients,
    garnish,
    containsDairy,
    containsNuts,
    containsGluten,
    containsCaffeine,
    dietaryTags,
    allergensContains,
    allergensMayContain,
    canBeMadeNonAlcoholic,
    canBeMadeDecaf,
    pairings: [],
    recommendationTags: [],
    signatureScore: null,
    popularityScore: null,
  });

  const scores = inferScores(entry, {
    category,
    subcategory,
    drinkType,
    alcoholic,
    servedStyle,
    temperature,
    baseSpirit,
    beerStyle,
    wineType,
    grapeVarietal,
    region,
    country,
    roastLevel,
    caffeineLevel,
    sweetnessLevel,
    bitternessLevel,
    acidityLevel,
    bodyLevel,
    flavorProfile,
    keyIngredients,
    garnish,
    containsDairy,
    containsNuts,
    containsGluten,
    containsCaffeine,
    dietaryTags,
    allergensContains,
    allergensMayContain,
    canBeMadeNonAlcoholic,
    canBeMadeDecaf,
    pairings,
    recommendationTags: [],
    signatureScore: null,
    popularityScore: null,
  });

  return {
    category,
    subcategory,
    drinkType,
    alcoholic,
    servedStyle,
    temperature,
    baseSpirit,
    beerStyle,
    wineType,
    grapeVarietal,
    region,
    country,
    roastLevel,
    caffeineLevel,
    sweetnessLevel,
    bitternessLevel,
    acidityLevel,
    bodyLevel,
    flavorProfile,
    keyIngredients,
    garnish,
    containsDairy,
    containsNuts,
    containsGluten,
    containsCaffeine,
    dietaryTags,
    allergensContains,
    allergensMayContain,
    canBeMadeNonAlcoholic,
    canBeMadeDecaf,
    pairings,
    recommendationTags: inferRecommendationTags(entry, {
      category,
      subcategory,
      drinkType,
      alcoholic,
      servedStyle,
      temperature,
      baseSpirit,
      beerStyle,
      wineType,
      grapeVarietal,
      region,
      country,
      roastLevel,
      caffeineLevel,
      sweetnessLevel,
      bitternessLevel,
      acidityLevel,
      bodyLevel,
      flavorProfile,
      keyIngredients,
      garnish,
      containsDairy,
      containsNuts,
      containsGluten,
      containsCaffeine,
      dietaryTags,
      allergensContains,
      allergensMayContain,
      canBeMadeNonAlcoholic,
      canBeMadeDecaf,
      pairings,
      recommendationTags: [],
      signatureScore: null,
      popularityScore: null,
    }),
    signatureScore: scores.signatureScore,
    popularityScore: scores.popularityScore,
  };
}

function buildDescriptions(
  name: string,
  entry: FlattenedEntry,
  classification: Classification,
  servingSize: string | null,
): {
  shortDescription: string | null;
  fullDescription: string | null;
  customizationRules: string | null;
} {
  const shortDescription = compact([
    classification.flavorProfile
      ? `${name} with ${classification.flavorProfile}.`
      : `${name} from the Old School House drinks list.`,
  ])[0]!;

  const measureNote = servingSize ? `Served as ${servingSize}.` : null;
  const itemNote = normalizeText(entry.item.note);
  const itemDetail = normalizeText(entry.item.detail);
  const sectionNote = normalizeText(entry.panelNote);
  const sourceMeasure = normalizeText(entry.measure);

  const fullDescription = dedupe(
    compact([
      shortDescription,
      itemNote,
      itemDetail,
      sourceMeasure ? `Menu measure: ${sourceMeasure}.` : null,
      sectionNote,
      measureNote,
    ]),
  ).join(' ');

  const customizationRules = dedupe(
    compact([
      itemDetail,
      sourceMeasure && sourceMeasure.includes('/')
        ? `Available in ${sourceMeasure.replace(/·/g, '')}.`
        : null,
      entry.measure?.toLowerCase().includes('mixers +1.50') ? 'Add a mixer for +1.50.' : null,
    ]),
  ).join(' ');

  return {
    shortDescription,
    fullDescription,
    customizationRules: customizationRules || null,
  };
}

function buildExternalDrinkId(entry: FlattenedEntry, seen: Map<string, number>): string {
  const base = slugify(`${entry.sectionTitle}-${entry.item.name}`);
  const next = (seen.get(base) ?? 0) + 1;
  seen.set(base, next);
  return next === 1 ? base : `${base}-${next}`;
}

function buildModifierPayloads(
  externalDrinkId: string,
  measureOptions: Array<{ label: string; price: number }>,
): { groups: ModifierGroupPayload[]; options: ModifierOptionPayload[] } {
  if (measureOptions.length <= 1) {
    return { groups: [], options: [] };
  }

  const groupId = `${externalDrinkId}--pour-size`;
  return {
    groups: [
      {
        externalModifierGroupId: groupId,
        externalDrinkId,
        groupName: 'Pour size',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        displayOrder: 0,
      },
    ],
    options: measureOptions.map((option, index) => ({
      externalModifierOptionId: `${groupId}--${slugify(option.label)}`,
      externalModifierGroupId: groupId,
      optionName: option.label,
      priceDelta: Number((option.price - measureOptions[0]!.price).toFixed(2)),
      defaultSelected: index === 0,
      availabilityStatus: 'available',
      displayOrder: index,
    })),
  };
}

function flattenSource(payload: SourcePayload): FlattenedEntry[] {
  const entries: FlattenedEntry[] = [];
  let displayOrder = 0;

  for (const page of payload.pages) {
    for (const column of page.columns) {
      for (const panel of column.panels) {
        for (const section of panel.sections) {
          for (const item of section.items) {
            if (extractNumericPrice(item.price) === null) {
              continue;
            }

            entries.push({
              pageId: page.id,
              pageTitle: page.title,
              pageSubtitle: normalizeText(page.subtitle),
              panelTitle: panel.title,
              panelNote: normalizeText(panel.note),
              sectionTitle: section.title,
              measure: normalizeText(section.measure),
              item,
              displayOrder,
            });

            displayOrder += 1;
          }
        }
      }
    }
  }

  return entries;
}

function normalizeEntry(
  entry: FlattenedEntry,
  externalDrinkId: string,
): {
  item: DrinkItemUpsertInput;
  modifierGroups: ModifierGroupPayload[];
  modifierOptions: ModifierOptionPayload[];
} {
  const name = cleanDrinkName(entry.item.name);
  const measureOptions = parseMeasureOptions(entry);
  const classification = inferClassification(entry);
  const volumeMl = inferVolumeMl(entry, measureOptions);
  const servingSize = inferServingSize(entry, measureOptions);
  const { shortDescription, fullDescription, customizationRules } = buildDescriptions(
    name,
    entry,
    classification,
    servingSize,
  );
  const abv = inferAbv(name, classification);
  const { groups, options } = buildModifierPayloads(externalDrinkId, measureOptions);

  const item = DrinkItemUpsertInputSchema.parse({
    externalDrinkId,
    drinkName: name,
    category: classification.category,
    subcategory: classification.subcategory,
    shortDescription,
    fullDescription,
    basePrice: extractNumericPrice(entry.item.price) ?? 0,
    currency: 'GBP',
    serviceTime: 'All Day',
    availabilityStatus: 'available',
    drinkType: classification.drinkType,
    alcoholic: classification.alcoholic,
    abv,
    volumeMl,
    servingSize,
    servedStyle: classification.servedStyle,
    temperature: classification.temperature,
    baseSpirit: classification.baseSpirit,
    beerStyle: classification.beerStyle,
    wineType: classification.wineType,
    grapeVarietal: classification.grapeVarietal,
    region: classification.region,
    country: classification.country,
    roastLevel: classification.roastLevel,
    caffeineLevel: classification.caffeineLevel,
    sweetnessLevel: classification.sweetnessLevel,
    bitternessLevel: classification.bitternessLevel,
    acidityLevel: classification.acidityLevel,
    bodyLevel: classification.bodyLevel,
    flavorProfile: classification.flavorProfile,
    keyIngredients: classification.keyIngredients,
    garnish: classification.garnish,
    containsDairy: classification.containsDairy,
    containsNuts: classification.containsNuts,
    containsGluten: classification.containsGluten,
    containsCaffeine: classification.containsCaffeine,
    dietaryTags: classification.dietaryTags,
    allergensContains: classification.allergensContains,
    allergensMayContain: classification.allergensMayContain,
    canBeMadeNonAlcoholic: classification.canBeMadeNonAlcoholic,
    canBeMadeDecaf: classification.canBeMadeDecaf,
    customizationRules,
    pairings: classification.pairings,
    signatureScore: classification.signatureScore,
    popularityScore: classification.popularityScore,
    recommendationTags: classification.recommendationTags,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    active: true,
    displayOrder: entry.displayOrder,
    imageUrl: null,
    modifierGroups: [],
  });

  return { item, modifierGroups: groups, modifierOptions: options };
}

function loadSourcePayload(): SourcePayload {
  return loadWindowAssignedObjectLiteral<SourcePayload>(SOURCE_JS_PATH, 'DRINKS_MENU_DATA');
}

async function loadSourceRestaurant(): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', SOURCE_RESTAURANT_SLUG)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to load source restaurant "${SOURCE_RESTAURANT_SLUG}": ${error.message}`,
    );
  }
  if (!data) {
    throw new Error(`Source restaurant "${SOURCE_RESTAURANT_SLUG}" was not found.`);
  }
  return data as RestaurantRow;
}

async function ensureTargetRestaurant(
  sourceRestaurant: RestaurantRow,
): Promise<{ restaurantId: string; existed: boolean }> {
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

async function ensureMemberships(
  sourceRestaurantId: string,
  targetRestaurantId: string,
): Promise<{ copied: number; total: number }> {
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

    const existing = new Set(
      targetMemberships.rows.map((membership) => `${membership.user_id}:${membership.role}`),
    );
    const missing = sourceMemberships.rows.filter(
      (membership) => !existing.has(`${membership.user_id}:${membership.role}`),
    );

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

async function assertDrinkSchemaAvailable(): Promise<void> {
  const { error } = await supabase.rpc('import_restaurant_drink_menu_bundle', {
    p_restaurant_id: '00000000-0000-0000-0000-000000000000',
    p_items: [],
    p_modifier_groups: [],
    p_modifier_options: [],
    p_replace_modifiers: false,
  });

  if (error && /function .* does not exist|schema cache/i.test(error.message)) {
    throw new Error(
      'Staging drink-menu RPC is not available yet. Apply the drinks migration before seeding.',
    );
  }
}

async function importDrinkItems(
  restaurantId: string,
  items: DrinkItemUpsertInput[],
  modifierGroups: ModifierGroupPayload[],
  modifierOptions: ModifierOptionPayload[],
) {
  if (!APPLY) {
    return {
      applied: false,
      plannedItemCount: items.length,
      plannedModifierGroupCount: modifierGroups.length,
      plannedModifierOptionCount: modifierOptions.length,
    };
  }

  const rpcResult = await supabase.rpc('import_restaurant_drink_menu_bundle', {
    p_restaurant_id: restaurantId,
    p_items: items,
    p_modifier_groups: modifierGroups,
    p_modifier_options: modifierOptions,
    p_replace_modifiers: true,
  });

  if (rpcResult.error) {
    throw new Error(`Drink menu import RPC failed: ${rpcResult.error.message}`);
  }

  return {
    applied: true,
    mode: 'rpc',
    itemCount: items.length,
    modifierGroupCount: modifierGroups.length,
    modifierOptionCount: modifierOptions.length,
    result: rpcResult.data,
  };
}

async function readBackSummary(restaurantId: string) {
  return withPgClient(async (client) => {
    const [restaurant, drinkItems, groups, options] = await Promise.all([
      client.query(
        `select id, name, slug, timezone, address, contact_email, contact_phone
         from public.restaurants
         where id = $1`,
        [restaurantId],
      ),
      client.query(
        `select id, external_drink_id, drink_name, category, subcategory, base_price, currency, display_order
         from public.restaurant_drink_menu_items
         where restaurant_id = $1
         order by display_order asc, drink_name asc`,
        [restaurantId],
      ),
      client.query(
        `select groups.external_modifier_group_id, items.external_drink_id, groups.group_name
         from public.restaurant_drink_menu_modifier_groups groups
         join public.restaurant_drink_menu_items items
           on items.id = groups.drink_item_id
          and items.restaurant_id = groups.restaurant_id
         where groups.restaurant_id = $1
         order by items.external_drink_id asc, groups.display_order asc`,
        [restaurantId],
      ),
      client.query(
        `select options.external_modifier_option_id, groups.external_modifier_group_id, options.option_name, options.price_delta
         from public.restaurant_drink_menu_modifier_options options
         join public.restaurant_drink_menu_modifier_groups groups
           on groups.id = options.modifier_group_id
          and groups.restaurant_id = options.restaurant_id
         where options.restaurant_id = $1
         order by groups.external_modifier_group_id asc, options.display_order asc`,
        [restaurantId],
      ),
    ]);

    return {
      restaurant: restaurant.rows[0] ?? null,
      drinkItemCount: drinkItems.rows.length,
      modifierGroupCount: groups.rows.length,
      modifierOptionCount: options.rows.length,
      firstTwelveDrinks: drinkItems.rows.slice(0, 12),
      modifierSamples: groups.rows.slice(0, 6).map((group) => ({
        ...group,
        options: options.rows.filter(
          (option) => option.external_modifier_group_id === group.external_modifier_group_id,
        ),
      })),
    };
  });
}

async function main() {
  const payload = loadSourcePayload();
  const sourceRestaurant = await loadSourceRestaurant();
  const targetRestaurant = await ensureTargetRestaurant(sourceRestaurant);

  await assertDrinkSchemaAvailable();

  const entries = flattenSource(payload);
  const seenExternalIds = new Map<string, number>();
  const normalized = entries.map((entry) =>
    normalizeEntry(entry, buildExternalDrinkId(entry, seenExternalIds)),
  );
  const items = normalized.map((record) => record.item);
  const modifierGroups = normalized.flatMap((record) => record.modifierGroups);
  const modifierOptions = normalized.flatMap((record) => record.modifierOptions);

  writeJsonArtifact('source-summary.json', {
    venue: payload.venue,
    footerNote: payload.footerNote ?? null,
    pageCount: payload.pages.length,
    flattenedEntryCount: entries.length,
  });
  writeJsonArtifact('normalized-drink-items.json', items);
  writeJsonArtifact('normalized-drink-modifiers.json', {
    modifierGroups,
    modifierOptions,
  });

  const membershipSummary =
    targetRestaurant.restaurantId === 'dry-run-target-restaurant'
      ? { copied: 0, total: 0 }
      : await ensureMemberships(sourceRestaurant.id, targetRestaurant.restaurantId);

  const importResult =
    targetRestaurant.restaurantId === 'dry-run-target-restaurant'
      ? {
          applied: false,
          plannedItemCount: items.length,
          plannedModifierGroupCount: modifierGroups.length,
          plannedModifierOptionCount: modifierOptions.length,
        }
      : await importDrinkItems(
          targetRestaurant.restaurantId,
          items,
          modifierGroups,
          modifierOptions,
        );

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
    modifierGroupCount: modifierGroups.length,
    modifierOptionCount: modifierOptions.length,
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
