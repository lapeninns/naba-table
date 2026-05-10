-- Idempotent canonical menu hierarchy backfill.
--
-- This creates default Food and Drinks menu containers per restaurant,
-- promotes legacy category/subcategory groups into sections, attaches
-- existing food rows in place, and copies drink rows into canonical
-- restaurant_menu_items with item_kind = 'drink'.

BEGIN;

WITH restaurants_with_food AS (
  SELECT DISTINCT restaurant_id
  FROM public.restaurant_menu_items
),
inserted_food_menus AS (
  INSERT INTO public.restaurant_menus (
    restaurant_id,
    labels,
    default_language_code,
    menu_kind,
    display_order,
    active,
    legacy_source
  )
  SELECT
    restaurant_id,
    jsonb_build_array(jsonb_build_object('displayName', 'Food menu', 'languageCode', 'en-GB')),
    'en-GB',
    'food',
    0,
    true,
    jsonb_build_object('legacyMenuKey', 'food-default', 'sourceTable', 'restaurant_menu_items')
  FROM restaurants_with_food source
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.restaurant_menus existing
    WHERE existing.restaurant_id = source.restaurant_id
      AND existing.legacy_source ->> 'legacyMenuKey' = 'food-default'
  )
  RETURNING id
)
SELECT count(*) AS inserted_food_menu_count
FROM inserted_food_menus;

WITH restaurants_with_drinks AS (
  SELECT DISTINCT restaurant_id
  FROM public.restaurant_drink_menu_items
),
inserted_drink_menus AS (
  INSERT INTO public.restaurant_menus (
    restaurant_id,
    labels,
    default_language_code,
    menu_kind,
    display_order,
    active,
    legacy_source
  )
  SELECT
    restaurant_id,
    jsonb_build_array(jsonb_build_object('displayName', 'Drinks menu', 'languageCode', 'en-GB')),
    'en-GB',
    'drinks',
    10,
    true,
    jsonb_build_object('legacyMenuKey', 'drinks-default', 'sourceTable', 'restaurant_drink_menu_items')
  FROM restaurants_with_drinks source
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.restaurant_menus existing
    WHERE existing.restaurant_id = source.restaurant_id
      AND existing.legacy_source ->> 'legacyMenuKey' = 'drinks-default'
  )
  RETURNING id
)
SELECT count(*) AS inserted_drink_menu_count
FROM inserted_drink_menus;

WITH food_groups AS (
  SELECT
    item.restaurant_id,
    menu.id AS menu_id,
    item.category,
    item.subcategory,
    min(item.display_order) AS display_order
  FROM public.restaurant_menu_items item
  JOIN public.restaurant_menus menu
    ON menu.restaurant_id = item.restaurant_id
   AND menu.legacy_source ->> 'legacyMenuKey' = 'food-default'
  WHERE item.item_kind = 'food'
  GROUP BY item.restaurant_id, menu.id, item.category, item.subcategory
),
inserted_food_sections AS (
  INSERT INTO public.restaurant_menu_sections (
    restaurant_id,
    menu_id,
    labels,
    display_order,
    active,
    legacy_category,
    legacy_subcategory,
    legacy_source
  )
  SELECT
    restaurant_id,
    menu_id,
    jsonb_build_array(jsonb_build_object(
      'displayName',
      CASE
        WHEN subcategory IS NULL THEN category
        ELSE category || ' - ' || subcategory
      END,
      'languageCode',
      'en-GB'
    )),
    display_order,
    true,
    category,
    subcategory,
    jsonb_build_object('legacySectionKey', concat_ws(' / ', category, subcategory), 'sourceTable', 'restaurant_menu_items')
  FROM food_groups source
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.restaurant_menu_sections existing
    WHERE existing.restaurant_id = source.restaurant_id
      AND existing.menu_id = source.menu_id
      AND existing.legacy_category IS NOT DISTINCT FROM source.category
      AND existing.legacy_subcategory IS NOT DISTINCT FROM source.subcategory
  )
  RETURNING id
)
SELECT count(*) AS inserted_food_section_count
FROM inserted_food_sections;

WITH drink_groups AS (
  SELECT
    drink.restaurant_id,
    menu.id AS menu_id,
    drink.category,
    drink.subcategory,
    min(drink.display_order) AS display_order
  FROM public.restaurant_drink_menu_items drink
  JOIN public.restaurant_menus menu
    ON menu.restaurant_id = drink.restaurant_id
   AND menu.legacy_source ->> 'legacyMenuKey' = 'drinks-default'
  GROUP BY drink.restaurant_id, menu.id, drink.category, drink.subcategory
),
inserted_drink_sections AS (
  INSERT INTO public.restaurant_menu_sections (
    restaurant_id,
    menu_id,
    labels,
    display_order,
    active,
    legacy_category,
    legacy_subcategory,
    legacy_source
  )
  SELECT
    restaurant_id,
    menu_id,
    jsonb_build_array(jsonb_build_object(
      'displayName',
      CASE
        WHEN subcategory IS NULL THEN category
        ELSE category || ' - ' || subcategory
      END,
      'languageCode',
      'en-GB'
    )),
    display_order,
    true,
    category,
    subcategory,
    jsonb_build_object('legacySectionKey', concat_ws(' / ', category, subcategory), 'sourceTable', 'restaurant_drink_menu_items')
  FROM drink_groups source
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.restaurant_menu_sections existing
    WHERE existing.restaurant_id = source.restaurant_id
      AND existing.menu_id = source.menu_id
      AND existing.legacy_category IS NOT DISTINCT FROM source.category
      AND existing.legacy_subcategory IS NOT DISTINCT FROM source.subcategory
  )
  RETURNING id
)
SELECT count(*) AS inserted_drink_section_count
FROM inserted_drink_sections;

UPDATE public.restaurant_menu_items item
SET
  menu_id = menu.id,
  section_id = section.id,
  item_kind = 'food',
  labels = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'displayName', item.item_name,
    'description', COALESCE(item.short_description, item.full_description),
    'languageCode', 'en-GB'
  ))),
  google_attributes = jsonb_strip_nulls(jsonb_build_object(
    'price', jsonb_build_object('currencyCode', item.currency, 'amount', item.base_price),
    'ingredients', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'labels',
        jsonb_build_array(jsonb_build_object('displayName', ingredient, 'languageCode', 'en-GB'))
      )), '[]'::jsonb)
      FROM unnest(item.key_ingredients) AS ingredient
    ),
    'mediaKeys', '[]'::jsonb,
    'nutritionFacts', jsonb_strip_nulls(jsonb_build_object(
      'calories', CASE WHEN item.calories_kcal IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.calories_kcal, 'unit', 'CALORIE') END,
      'protein', CASE WHEN item.protein_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.protein_g, 'unit', 'GRAM') END,
      'totalFat', CASE WHEN item.fat_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.fat_g, 'unit', 'GRAM') END,
      'saturatedFat', CASE WHEN item.saturated_fat_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.saturated_fat_g, 'unit', 'GRAM') END,
      'totalCarbohydrate', CASE WHEN item.carbs_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.carbs_g, 'unit', 'GRAM') END,
      'sugars', CASE WHEN item.sugar_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.sugar_g, 'unit', 'GRAM') END,
      'dietaryFiber', CASE WHEN item.fiber_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.fiber_g, 'unit', 'GRAM') END,
      'sodium', CASE WHEN item.sodium_mg IS NULL THEN NULL ELSE jsonb_build_object('quantity', item.sodium_mg, 'unit', 'MILLIGRAM') END
    )),
    'servesNumPeople', item.serves_num
  )),
  google_media_keys = ARRAY[]::text[],
  local_media = jsonb_strip_nulls(jsonb_build_object('imageUrl', item.image_url)),
  legacy_source = item.legacy_source || jsonb_build_object(
    'sourceTable', 'restaurant_menu_items',
    'legacyItemKind', 'food',
    'legacyCategory', item.category,
    'legacySubcategory', item.subcategory
  )
FROM public.restaurant_menus menu
JOIN public.restaurant_menu_sections section
  ON section.restaurant_id = menu.restaurant_id
 AND section.menu_id = menu.id
WHERE menu.restaurant_id = item.restaurant_id
  AND menu.legacy_source ->> 'legacyMenuKey' = 'food-default'
  AND section.legacy_category IS NOT DISTINCT FROM item.category
  AND section.legacy_subcategory IS NOT DISTINCT FROM item.subcategory
  AND item.item_kind = 'food';

WITH source_drinks AS (
  SELECT
    drink.*,
    menu.id AS canonical_menu_id,
    section.id AS canonical_section_id
  FROM public.restaurant_drink_menu_items drink
  JOIN public.restaurant_menus menu
    ON menu.restaurant_id = drink.restaurant_id
   AND menu.legacy_source ->> 'legacyMenuKey' = 'drinks-default'
  JOIN public.restaurant_menu_sections section
    ON section.restaurant_id = drink.restaurant_id
   AND section.menu_id = menu.id
   AND section.legacy_category IS NOT DISTINCT FROM drink.category
   AND section.legacy_subcategory IS NOT DISTINCT FROM drink.subcategory
)
INSERT INTO public.restaurant_menu_items (
  restaurant_id,
  menu_id,
  section_id,
  item_kind,
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
  flavor_profile,
  portion_size,
  recommendation_tags,
  pairings,
  signature_score,
  popularity_score,
  dietary_tags,
  allergens_contains,
  allergens_may_contain,
  customization_rules,
  active,
  seasonal,
  limited_time,
  sold_out,
  display_order,
  image_url,
  calories_kcal,
  protein_g,
  fat_g,
  saturated_fat_g,
  carbs_g,
  sugar_g,
  fiber_g,
  sodium_mg,
  serves_num,
  labels,
  google_attributes,
  google_media_keys,
  local_media,
  legacy_source
)
SELECT
  restaurant_id,
  canonical_menu_id,
  canonical_section_id,
  'drink',
  'drink:' || external_drink_id,
  drink_name,
  category,
  subcategory,
  short_description,
  full_description,
  base_price,
  currency,
  service_time,
  availability_status,
  key_ingredients,
  flavor_profile,
  serving_size,
  recommendation_tags,
  pairings,
  signature_score,
  popularity_score,
  dietary_tags,
  allergens_contains,
  allergens_may_contain,
  customization_rules,
  active,
  seasonal,
  limited_time,
  sold_out,
  display_order,
  image_url,
  calories_kcal,
  protein_g,
  fat_g,
  saturated_fat_g,
  carbs_g,
  sugar_g,
  fiber_g,
  sodium_mg,
  serves_num,
  jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'displayName', drink_name,
    'description', COALESCE(short_description, full_description),
    'languageCode', 'en-GB'
  ))),
  jsonb_strip_nulls(jsonb_build_object(
    'price', jsonb_build_object('currencyCode', currency, 'amount', base_price),
    'ingredients', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'labels',
        jsonb_build_array(jsonb_build_object('displayName', ingredient, 'languageCode', 'en-GB'))
      )), '[]'::jsonb)
      FROM unnest(key_ingredients) AS ingredient
    ),
    'mediaKeys', '[]'::jsonb,
    'nutritionFacts', jsonb_strip_nulls(jsonb_build_object(
      'calories', CASE WHEN calories_kcal IS NULL THEN NULL ELSE jsonb_build_object('quantity', calories_kcal, 'unit', 'CALORIE') END,
      'protein', CASE WHEN protein_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', protein_g, 'unit', 'GRAM') END,
      'totalFat', CASE WHEN fat_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', fat_g, 'unit', 'GRAM') END,
      'saturatedFat', CASE WHEN saturated_fat_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', saturated_fat_g, 'unit', 'GRAM') END,
      'totalCarbohydrate', CASE WHEN carbs_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', carbs_g, 'unit', 'GRAM') END,
      'sugars', CASE WHEN sugar_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', sugar_g, 'unit', 'GRAM') END,
      'dietaryFiber', CASE WHEN fiber_g IS NULL THEN NULL ELSE jsonb_build_object('quantity', fiber_g, 'unit', 'GRAM') END,
      'sodium', CASE WHEN sodium_mg IS NULL THEN NULL ELSE jsonb_build_object('quantity', sodium_mg, 'unit', 'MILLIGRAM') END
    )),
    'servesNumPeople', serves_num
  )),
  ARRAY[]::text[],
  jsonb_strip_nulls(jsonb_build_object('imageUrl', image_url)),
  jsonb_build_object(
    'sourceTable', 'restaurant_drink_menu_items',
    'legacyItemKind', 'drink',
    'legacyDrinkItemId', id,
    'legacyExternalDrinkId', external_drink_id,
    'legacyCategory', category,
    'legacySubcategory', subcategory
  )
FROM source_drinks
ON CONFLICT (restaurant_id, external_item_id) DO UPDATE
SET
  menu_id = EXCLUDED.menu_id,
  section_id = EXCLUDED.section_id,
  item_kind = 'drink',
  labels = EXCLUDED.labels,
  google_attributes = EXCLUDED.google_attributes,
  google_media_keys = EXCLUDED.google_media_keys,
  local_media = EXCLUDED.local_media,
  legacy_source = public.restaurant_menu_items.legacy_source || EXCLUDED.legacy_source;

WITH canonical_drinks AS (
  SELECT
    canonical.restaurant_id,
    canonical.id AS menu_item_id,
    drink.id AS legacy_drink_item_id,
    drink.external_drink_id,
    drink.drink_type,
    drink.alcoholic,
    drink.abv,
    drink.volume_ml,
    drink.serving_size,
    drink.served_style,
    drink.temperature,
    drink.base_spirit,
    drink.beer_style,
    drink.wine_type,
    drink.grape_varietal,
    drink.region,
    drink.country,
    drink.roast_level,
    drink.caffeine_level,
    drink.sweetness_level,
    drink.bitterness_level,
    drink.acidity_level,
    drink.body_level,
    drink.garnish,
    drink.contains_dairy,
    drink.contains_nuts,
    drink.contains_gluten,
    drink.contains_caffeine,
    drink.can_be_made_non_alcoholic,
    drink.can_be_made_decaf
  FROM public.restaurant_menu_items canonical
  JOIN public.restaurant_drink_menu_items drink
    ON drink.restaurant_id = canonical.restaurant_id
   AND 'drink:' || drink.external_drink_id = canonical.external_item_id
  WHERE canonical.item_kind = 'drink'
)
INSERT INTO public.restaurant_menu_item_extensions (
  restaurant_id,
  menu_item_id,
  drink_profile,
  recommendation_metadata,
  availability_policy,
  customization_controls,
  source_metadata
)
SELECT
  restaurant_id,
  menu_item_id,
  jsonb_strip_nulls(jsonb_build_object(
    'drinkType', drink_type,
    'alcoholic', alcoholic,
    'abv', abv,
    'volumeMl', volume_ml,
    'servingSize', serving_size,
    'servedStyle', served_style,
    'temperature', temperature,
    'baseSpirit', base_spirit,
    'beerStyle', beer_style,
    'wineType', wine_type,
    'grapeVarietal', grape_varietal,
    'region', region,
    'country', country,
    'roastLevel', roast_level,
    'caffeineLevel', caffeine_level,
    'sweetnessLevel', sweetness_level,
    'bitternessLevel', bitterness_level,
    'acidityLevel', acidity_level,
    'bodyLevel', body_level,
    'garnish', garnish
  )),
  '{}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'containsDairy', contains_dairy,
    'containsNuts', contains_nuts,
    'containsGluten', contains_gluten,
    'containsCaffeine', contains_caffeine,
    'canBeMadeNonAlcoholic', can_be_made_non_alcoholic,
    'canBeMadeDecaf', can_be_made_decaf
  )),
  '{}'::jsonb,
  jsonb_build_object(
    'sourceTable', 'restaurant_drink_menu_items',
    'legacyDrinkItemId', legacy_drink_item_id,
    'legacyExternalDrinkId', external_drink_id
  )
FROM canonical_drinks
ON CONFLICT (restaurant_id, menu_item_id) DO UPDATE
SET
  drink_profile = EXCLUDED.drink_profile,
  availability_policy = EXCLUDED.availability_policy,
  source_metadata = public.restaurant_menu_item_extensions.source_metadata || EXCLUDED.source_metadata;

COMMIT;
