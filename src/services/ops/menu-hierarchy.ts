import { fetchJson, type RequestSignalOptions } from '@/lib/http/fetchJson';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  RestaurantMenuInput,
  RestaurantMenuItemInput,
  RestaurantMenuItemPatch,
  RestaurantMenuOptionInput,
  RestaurantMenuOptionPatch,
  RestaurantMenuPatch,
  RestaurantMenuSectionInput,
  RestaurantMenuSectionPatch,
} from '@/server/menu-hierarchy/types';

const buildMenusBase = (restaurantId: string) =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/menus`;

const buildMenuBase = (restaurantId: string, menuId: string) =>
  `${buildMenusBase(restaurantId)}/${encodeURIComponent(menuId)}`;

const buildSectionsBase = (restaurantId: string, menuId: string) =>
  `${buildMenuBase(restaurantId, menuId)}/sections`;

const buildSectionBase = (restaurantId: string, menuId: string, sectionId: string) =>
  `${buildSectionsBase(restaurantId, menuId)}/${encodeURIComponent(sectionId)}`;

const buildItemsBase = (restaurantId: string, menuId: string, sectionId: string) =>
  `${buildSectionBase(restaurantId, menuId, sectionId)}/items`;

const buildItemBase = (restaurantId: string, menuId: string, sectionId: string, itemId: string) =>
  `${buildItemsBase(restaurantId, menuId, sectionId)}/${encodeURIComponent(itemId)}`;

const buildOptionsBase = (
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
) => `${buildItemBase(restaurantId, menuId, sectionId, itemId)}/options`;

const buildOptionBase = (
  restaurantId: string,
  menuId: string,
  sectionId: string,
  itemId: string,
  optionId: string,
) => `${buildOptionsBase(restaurantId, menuId, sectionId, itemId)}/${encodeURIComponent(optionId)}`;

type MenuHierarchyResponse = {
  menus: CanonicalRestaurantMenu[];
};

type MenuResponse = {
  menu: CanonicalRestaurantMenu;
};

type SectionResponse = {
  section: CanonicalRestaurantMenuSection;
};

type ItemResponse = {
  item: CanonicalRestaurantMenuItem;
};

type OptionResponse = {
  option: CanonicalRestaurantMenuOption;
};

export interface MenuHierarchyService {
  listMenus(restaurantId: string, options?: RequestSignalOptions): Promise<MenuHierarchyResponse>;
  createMenu(restaurantId: string, payload: RestaurantMenuInput): Promise<CanonicalRestaurantMenu>;
  updateMenu(
    restaurantId: string,
    menuId: string,
    payload: RestaurantMenuPatch,
  ): Promise<CanonicalRestaurantMenu>;
  createSection(
    restaurantId: string,
    menuId: string,
    payload: RestaurantMenuSectionInput,
  ): Promise<CanonicalRestaurantMenuSection>;
  updateSection(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    payload: RestaurantMenuSectionPatch,
  ): Promise<CanonicalRestaurantMenuSection>;
  createItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    payload: RestaurantMenuItemInput,
  ): Promise<CanonicalRestaurantMenuItem>;
  updateItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    payload: RestaurantMenuItemPatch,
  ): Promise<CanonicalRestaurantMenuItem>;
  createOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    payload: RestaurantMenuOptionInput,
  ): Promise<CanonicalRestaurantMenuOption>;
  updateOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    optionId: string,
    payload: RestaurantMenuOptionPatch,
  ): Promise<CanonicalRestaurantMenuOption>;
  deleteOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    optionId: string,
  ): Promise<void>;
  deleteMenu(restaurantId: string, menuId: string): Promise<void>;
  deleteSection(restaurantId: string, menuId: string, sectionId: string): Promise<void>;
  deleteItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
  ): Promise<void>;
}

export type MenuHierarchyServiceFactory = () => MenuHierarchyService;

class DefaultMenuHierarchyService implements MenuHierarchyService {
  listMenus(restaurantId: string, options?: RequestSignalOptions): Promise<MenuHierarchyResponse> {
    return fetchJson<MenuHierarchyResponse>(buildMenusBase(restaurantId), options);
  }

  async createMenu(
    restaurantId: string,
    payload: RestaurantMenuInput,
  ): Promise<CanonicalRestaurantMenu> {
    const response = await fetchJson<MenuResponse>(buildMenusBase(restaurantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.menu;
  }

  async updateMenu(
    restaurantId: string,
    menuId: string,
    payload: RestaurantMenuPatch,
  ): Promise<CanonicalRestaurantMenu> {
    const response = await fetchJson<MenuResponse>(buildMenuBase(restaurantId, menuId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.menu;
  }

  async createSection(
    restaurantId: string,
    menuId: string,
    payload: RestaurantMenuSectionInput,
  ): Promise<CanonicalRestaurantMenuSection> {
    const response = await fetchJson<SectionResponse>(buildSectionsBase(restaurantId, menuId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.section;
  }

  async updateSection(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    payload: RestaurantMenuSectionPatch,
  ): Promise<CanonicalRestaurantMenuSection> {
    const response = await fetchJson<SectionResponse>(
      buildSectionBase(restaurantId, menuId, sectionId),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.section;
  }

  async createItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    payload: RestaurantMenuItemInput,
  ): Promise<CanonicalRestaurantMenuItem> {
    const response = await fetchJson<ItemResponse>(
      buildItemsBase(restaurantId, menuId, sectionId),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.item;
  }

  async updateItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    payload: RestaurantMenuItemPatch,
  ): Promise<CanonicalRestaurantMenuItem> {
    const response = await fetchJson<ItemResponse>(
      buildItemBase(restaurantId, menuId, sectionId, itemId),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.item;
  }

  async createOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    payload: RestaurantMenuOptionInput,
  ): Promise<CanonicalRestaurantMenuOption> {
    const response = await fetchJson<OptionResponse>(
      buildOptionsBase(restaurantId, menuId, sectionId, itemId),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.option;
  }

  async updateOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    optionId: string,
    payload: RestaurantMenuOptionPatch,
  ): Promise<CanonicalRestaurantMenuOption> {
    const response = await fetchJson<OptionResponse>(
      buildOptionBase(restaurantId, menuId, sectionId, itemId, optionId),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.option;
  }

  async deleteOption(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
    optionId: string,
  ): Promise<void> {
    await fetchJson<{ ok: true }>(
      buildOptionBase(restaurantId, menuId, sectionId, itemId, optionId),
      {
        method: 'DELETE',
      },
    );
  }

  async deleteMenu(restaurantId: string, menuId: string): Promise<void> {
    await fetchJson<{ ok: true }>(buildMenuBase(restaurantId, menuId), { method: 'DELETE' });
  }

  async deleteSection(restaurantId: string, menuId: string, sectionId: string): Promise<void> {
    await fetchJson<{ ok: true }>(buildSectionBase(restaurantId, menuId, sectionId), {
      method: 'DELETE',
    });
  }

  async deleteItem(
    restaurantId: string,
    menuId: string,
    sectionId: string,
    itemId: string,
  ): Promise<void> {
    await fetchJson<{ ok: true }>(buildItemBase(restaurantId, menuId, sectionId, itemId), {
      method: 'DELETE',
    });
  }
}

class NotImplementedMenuHierarchyService implements MenuHierarchyService {
  private error(message: string): never {
    throw new Error(`[ops][menu-hierarchy] ${message}`);
  }

  listMenus(): Promise<MenuHierarchyResponse> {
    this.error('listMenus not implemented');
  }

  createMenu(): Promise<CanonicalRestaurantMenu> {
    this.error('createMenu not implemented');
  }

  updateMenu(): Promise<CanonicalRestaurantMenu> {
    this.error('updateMenu not implemented');
  }

  createSection(): Promise<CanonicalRestaurantMenuSection> {
    this.error('createSection not implemented');
  }

  updateSection(): Promise<CanonicalRestaurantMenuSection> {
    this.error('updateSection not implemented');
  }

  createItem(): Promise<CanonicalRestaurantMenuItem> {
    this.error('createItem not implemented');
  }

  updateItem(): Promise<CanonicalRestaurantMenuItem> {
    this.error('updateItem not implemented');
  }

  createOption(): Promise<CanonicalRestaurantMenuOption> {
    this.error('createOption not implemented');
  }

  updateOption(): Promise<CanonicalRestaurantMenuOption> {
    this.error('updateOption not implemented');
  }

  deleteOption(): Promise<void> {
    this.error('deleteOption not implemented');
  }

  deleteMenu(): Promise<void> {
    this.error('deleteMenu not implemented');
  }

  deleteSection(): Promise<void> {
    this.error('deleteSection not implemented');
  }

  deleteItem(): Promise<void> {
    this.error('deleteItem not implemented');
  }
}

export function createMenuHierarchyService(
  factory?: MenuHierarchyServiceFactory,
): MenuHierarchyService {
  try {
    return factory ? factory() : new DefaultMenuHierarchyService();
  } catch (error) {
    console.error('[ops][menu-hierarchy] failed to instantiate service', error);
    return new NotImplementedMenuHierarchyService();
  }
}
