import { describe, expect, it, vi, beforeEach } from 'vitest';

const getExistingMenuExternalIdsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/menu/repository', () => ({
  getExistingMenuExternalIds: getExistingMenuExternalIdsMock,
}));

import { prepareMenuImport } from '@/server/menu/import';

describe('prepareMenuImport', () => {
  beforeEach(() => {
    getExistingMenuExternalIdsMock.mockReset();
    getExistingMenuExternalIdsMock.mockResolvedValue({
      itemExternalIds: new Set<string>(),
      modifierGroupExternalIds: new Set<string>(),
      modifierOptionExternalIds: new Set<string>(),
    });
  });

  it('builds a clean preview for valid items-only imports and preserves modifiers', async () => {
    const result = await prepareMenuImport(
      'rest-1',
      {
        itemsText: `item_id,item_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,key_ingredients,main_protein_or_base,cooking_style,preparation_method,flavor_profile,texture,spice_level,spice_adjustable,portion_size,shareable,recommendation_tags,pairings,signature_score,popularity_score,dietary_tags,allergens_contains,allergens_may_contain,removable_ingredients,substitutions_allowed,can_be_made_vegetarian,can_be_made_vegan,can_be_made_gluten_free,customization_rules,serving_notes,active,seasonal,limited_time,sold_out,display_order,image_url
starter-burrata,Burrata,Starters,Cold,Short,Full,9.50,GBP,Lunch,available,"burrata,tomato",Cheese,Fresh,Plated,Bright,Soft,Mild,true,Starter,false,"signature,seasonal","white wine",90,80,Vegetarian,Milk,Nuts,Seeds,true,true,false,true,No balsamic,Serve chilled,true,true,false,false,10,https://example.com/burrata.jpg`,
      },
      {} as never,
    );

    expect(result.preview.canApply).toBe(true);
    expect(result.preview.summary.replaceModifiers).toBe(false);
    expect(result.preview.summary.itemRows).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.externalItemId).toBe('starter-burrata');
    expect(result.items[0]?.modifierGroups).toEqual([]);
  });

  it('flags orphaned modifier option references during preview', async () => {
    const result = await prepareMenuImport(
      'rest-1',
      {
        itemsText: `item_id,item_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,key_ingredients,main_protein_or_base,cooking_style,preparation_method,flavor_profile,texture,spice_level,spice_adjustable,portion_size,shareable,recommendation_tags,pairings,signature_score,popularity_score,dietary_tags,allergens_contains,allergens_may_contain,removable_ingredients,substitutions_allowed,can_be_made_vegetarian,can_be_made_vegan,can_be_made_gluten_free,customization_rules,serving_notes,active,seasonal,limited_time,sold_out,display_order,image_url
main-rigatoni,Rigatoni,Mains,Pasta,Short,Full,15.00,GBP,Dinner,available,,,Roasted,Baked,Rich,Soft,Medium,false,Main,false,,,70,88,,,,"",false,false,false,false,,Hot,true,false,false,false,20,`,
        modifierGroupsText: `modifier_group_id,item_id,group_name,required,min_select,max_select
rigatoni-add-ons,main-rigatoni,Add-ons,false,0,2`,
        modifierOptionsText: `modifier_option_id,modifier_group_id,option_name,price_delta,default_selected,availability_status
bad-option,missing-group,Extra chilli,0.50,false,available`,
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
    const result = await prepareMenuImport(
      'rest-1',
      {
        itemsText: `item_id,item_name,category,subcategory,short_description,full_description,base_price,currency,service_time,availability_status,key_ingredients,main_protein_or_base,cooking_style,preparation_method,flavor_profile,texture,spice_level,spice_adjustable,portion_size,shareable,recommendation_tags,pairings,signature_score,popularity_score,dietary_tags,allergens_contains,allergens_may_contain,removable_ingredients,substitutions_allowed,can_be_made_vegetarian,can_be_made_vegan,can_be_made_gluten_free,customization_rules,serving_notes,active,seasonal,limited_time,sold_out,display_order,image_url
main-rigatoni,Rigatoni,Mains,Pasta,Short,Full,15.00,GBP,Dinner,available,,,Roasted,Baked,Rich,Soft,Medium,false,Main,false,,,70,88,,,,"",false,false,false,false,,Hot,true,false,false,false,20,`,
        modifierGroupsText: `modifier_group_id,item_id,group_name,required,min_select,max_select
rigatoni-add-ons,main-rigatoni,Add-ons,false,0,2`,
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
});
