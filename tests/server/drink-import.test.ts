import { beforeEach, describe, expect, it, vi } from 'vitest';

const getExistingDrinkExternalIdsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/drinks-menu/repository', () => ({
  getExistingDrinkExternalIds: getExistingDrinkExternalIdsMock,
}));

import { prepareDrinkImport } from '@/server/drinks-menu/import';

describe('prepareDrinkImport', () => {
  beforeEach(() => {
    getExistingDrinkExternalIdsMock.mockReset();
    getExistingDrinkExternalIdsMock.mockResolvedValue({
      itemExternalIds: new Set<string>(),
      modifierGroupExternalIds: new Set<string>(),
      modifierOptionExternalIds: new Set<string>(),
    });
  });

  it('builds a clean preview for valid drinks-only imports and preserves modifiers', async () => {
    const result = await prepareDrinkImport(
      'rest-1',
      {
        itemsText: `drink_id,drink_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,drink_type,alcoholic,abv,volume_ml,serving_size,served_style,temperature,base_spirit,beer_style,wine_type,grape_varietal,region,country,roast_level,caffeine_level,sweetness_level,bitterness_level,acidity_level,body_level,flavor_profile,key_ingredients,garnish,contains_dairy,contains_nuts,contains_gluten,contains_caffeine,dietary_tags,allergens_contains,allergens_may_contain,can_be_made_non_alcoholic,can_be_made_decaf,customization_rules,pairings,signature_score,popularity_score,recommendation_tags,seasonal,limited_time,sold_out,active,display_order,image_url
house-negroni,House Negroni,cocktail,classic,Short,Full,11.50,GBP,Evening,available,cocktail,true,24,120,Short serve,On the rocks,Cold,Gin,,,,,United Kingdom,,Low,Low,High,Low,Medium,Bitter herbal citrus,"gin,sweet vermouth,campari",Orange peel,false,false,false,false,Vegan,,,true,false,Can be served up,"croquettes,steak",92,88,"house favourite,aperitif",false,false,false,true,10,https://example.com/negroni.jpg`,
      },
      {} as never,
    );

    expect(result.preview.canApply).toBe(true);
    expect(result.preview.summary.replaceModifiers).toBe(false);
    expect(result.preview.summary.itemRows).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.externalDrinkId).toBe('house-negroni');
    expect(result.items[0]?.modifierGroups).toEqual([]);
  });

  it('flags orphaned modifier option references during preview', async () => {
    const result = await prepareDrinkImport(
      'rest-1',
      {
        itemsText: `drink_id,drink_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,drink_type,alcoholic,abv,volume_ml,serving_size,served_style,temperature,base_spirit,beer_style,wine_type,grape_varietal,region,country,roast_level,caffeine_level,sweetness_level,bitterness_level,acidity_level,body_level,flavor_profile,key_ingredients,garnish,contains_dairy,contains_nuts,contains_gluten,contains_caffeine,dietary_tags,allergens_contains,allergens_may_contain,can_be_made_non_alcoholic,can_be_made_decaf,customization_rules,pairings,signature_score,popularity_score,recommendation_tags,seasonal,limited_time,sold_out,active,display_order,image_url
flat-white,Flat White,coffee_tea,coffee,Short,Full,3.80,GBP,Breakfast,available,coffee,false,,240,Regular,Hot,Hot,,,,,,,Medium,High,Low,Low,Medium,Silky,"coffee,milk",Cocoa,false,false,false,true,Vegetarian,Milk,,false,true,Decaf available,"pastries,cake",70,91,"comfort,daily",false,false,false,true,20,`,
        modifierGroupsText: `modifier_group_id,drink_id,group_name,required,min_select,max_select
coffee-milk,flat-white,Milk choice,false,0,1`,
        modifierOptionsText: `modifier_option_id,modifier_group_id,option_name,price_delta,default_selected,availability_status
bad-option,missing-group,Oat milk,0.50,false,available`,
      },
      {} as never,
    );

    expect(result.preview.canApply).toBe(false);
    expect(result.preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'modifier_options',
          column: 'modifier_group_id',
        }),
      ]),
    );
  });

  it('rejects modifier groups uploads unless modifier options are supplied too', async () => {
    const result = await prepareDrinkImport(
      'rest-1',
      {
        itemsText: `drink_id,drink_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,drink_type,alcoholic,abv,volume_ml,serving_size,served_style,temperature,base_spirit,beer_style,wine_type,grape_varietal,region,country,roast_level,caffeine_level,sweetness_level,bitterness_level,acidity_level,body_level,flavor_profile,key_ingredients,garnish,contains_dairy,contains_nuts,contains_gluten,contains_caffeine,dietary_tags,allergens_contains,allergens_may_contain,can_be_made_non_alcoholic,can_be_made_decaf,customization_rules,pairings,signature_score,popularity_score,recommendation_tags,seasonal,limited_time,sold_out,active,display_order,image_url
flat-white,Flat White,coffee_tea,coffee,Short,Full,3.80,GBP,Breakfast,available,coffee,false,,240,Regular,Hot,Hot,,,,,,,Medium,High,Low,Low,Medium,Silky,"coffee,milk",Cocoa,false,false,false,true,Vegetarian,Milk,,false,true,Decaf available,"pastries,cake",70,91,"comfort,daily",false,false,false,true,20,`,
        modifierGroupsText: `modifier_group_id,drink_id,group_name,required,min_select,max_select
coffee-milk,flat-white,Milk choice,false,0,1`,
      },
      {} as never,
    );

    expect(result.preview.canApply).toBe(false);
    expect(result.preview.summary.replaceModifiers).toBe(false);
    expect(result.preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'modifier_groups',
          column: 'modifier_group_id',
          message: 'modifier_options CSV is required when modifier_groups CSV is provided',
        }),
      ]),
    );
  });

  it('marks drinks as impacted when an empty modifier bundle is used to clear modifiers', async () => {
    const result = await prepareDrinkImport(
      'rest-1',
      {
        itemsText: `drink_id,drink_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,drink_type,alcoholic,abv,volume_ml,serving_size,served_style,temperature,base_spirit,beer_style,wine_type,grape_varietal,region,country,roast_level,caffeine_level,sweetness_level,bitterness_level,acidity_level,body_level,flavor_profile,key_ingredients,garnish,contains_dairy,contains_nuts,contains_gluten,contains_caffeine,dietary_tags,allergens_contains,allergens_may_contain,can_be_made_non_alcoholic,can_be_made_decaf,customization_rules,pairings,signature_score,popularity_score,recommendation_tags,seasonal,limited_time,sold_out,active,display_order,image_url
house-negroni,House Negroni,cocktail,classic,Short,Full,11.50,GBP,Evening,available,cocktail,true,24,120,Short serve,On the rocks,Cold,Gin,,,,,United Kingdom,,Low,Low,High,Low,Medium,Bitter herbal citrus,"gin,sweet vermouth,campari",Orange peel,false,false,false,false,Vegan,,,true,false,Can be served up,"croquettes,steak",92,88,"house favourite,aperitif",false,false,false,true,10,https://example.com/negroni.jpg`,
        modifierGroupsText: 'modifier_group_id,drink_id,group_name,required,min_select,max_select\n',
        modifierOptionsText:
          'modifier_option_id,modifier_group_id,option_name,price_delta,default_selected,availability_status\n',
      },
      {} as never,
    );

    expect(result.preview.canApply).toBe(true);
    expect(result.preview.summary.replaceModifiers).toBe(true);
    expect(result.preview.summary.impactedItemCount).toBe(1);
  });
});
