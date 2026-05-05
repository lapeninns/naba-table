import { fetchJson } from '@/lib/http/fetchJson';

import type {
  MenuImportResult,
  MenuItemDetail,
  MenuItemUpsertInput,
  MenuListFilters,
  MenuListResponse,
} from '@/server/menu/types';

const buildMenuItemsBase = (restaurantId: string) =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/menu/items`;

const buildMenuImportBase = (restaurantId: string) =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/menu/import`;

type MenuItemResponse = {
  item: MenuItemDetail;
};

export type MenuImportPayload = {
  itemsFile: File;
  modifierGroupsFile?: File | null;
  modifierOptionsFile?: File | null;
};

export interface MenuService {
  listItems(restaurantId: string, filters?: MenuListFilters): Promise<MenuListResponse>;
  getItem(restaurantId: string, itemId: string): Promise<MenuItemDetail>;
  createItem(restaurantId: string, payload: MenuItemUpsertInput): Promise<MenuItemDetail>;
  updateItem(restaurantId: string, itemId: string, payload: MenuItemUpsertInput): Promise<MenuItemDetail>;
  previewImport(restaurantId: string, payload: MenuImportPayload): Promise<MenuImportResult>;
  applyImport(restaurantId: string, payload: MenuImportPayload): Promise<MenuImportResult>;
}

export type MenuServiceFactory = () => MenuService;

class DefaultMenuService implements MenuService {
  async listItems(restaurantId: string, filters: MenuListFilters = {}): Promise<MenuListResponse> {
    const searchParams = new URLSearchParams();
    if (filters.search) searchParams.set('search', filters.search);
    if (filters.category) searchParams.set('category', filters.category);
    if (filters.subcategory) searchParams.set('subcategory', filters.subcategory);
    if (filters.status && filters.status !== 'all') searchParams.set('status', filters.status);

    const query = searchParams.toString();
    return fetchJson<MenuListResponse>(`${buildMenuItemsBase(restaurantId)}${query ? `?${query}` : ''}`);
  }

  async getItem(restaurantId: string, itemId: string): Promise<MenuItemDetail> {
    const response = await fetchJson<MenuItemResponse>(`${buildMenuItemsBase(restaurantId)}/${encodeURIComponent(itemId)}`);
    return response.item;
  }

  async createItem(restaurantId: string, payload: MenuItemUpsertInput): Promise<MenuItemDetail> {
    const response = await fetchJson<MenuItemResponse>(buildMenuItemsBase(restaurantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.item;
  }

  async updateItem(restaurantId: string, itemId: string, payload: MenuItemUpsertInput): Promise<MenuItemDetail> {
    const response = await fetchJson<MenuItemResponse>(`${buildMenuItemsBase(restaurantId)}/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.item;
  }

  async previewImport(restaurantId: string, payload: MenuImportPayload): Promise<MenuImportResult> {
    return postImport(buildMenuImportBase(restaurantId), payload, 'preview');
  }

  async applyImport(restaurantId: string, payload: MenuImportPayload): Promise<MenuImportResult> {
    return postImport(buildMenuImportBase(restaurantId), payload, 'apply');
  }
}

class NotImplementedMenuService implements MenuService {
  private error(message: string): never {
    throw new Error(`[ops][menu] ${message}`);
  }

  listItems(): Promise<MenuListResponse> {
    this.error('listItems not implemented');
  }

  getItem(): Promise<MenuItemDetail> {
    this.error('getItem not implemented');
  }

  createItem(): Promise<MenuItemDetail> {
    this.error('createItem not implemented');
  }

  updateItem(): Promise<MenuItemDetail> {
    this.error('updateItem not implemented');
  }

  previewImport(): Promise<MenuImportResult> {
    this.error('previewImport not implemented');
  }

  applyImport(): Promise<MenuImportResult> {
    this.error('applyImport not implemented');
  }
}

async function postImport(
  url: string,
  payload: MenuImportPayload,
  mode: 'preview' | 'apply',
): Promise<MenuImportResult> {
  const formData = new FormData();
  formData.set('mode', mode);
  formData.set('items', payload.itemsFile);
  if (payload.modifierGroupsFile) {
    formData.set('modifierGroups', payload.modifierGroupsFile);
  }
  if (payload.modifierOptionsFile) {
    formData.set('modifierOptions', payload.modifierOptionsFile);
  }

  return fetchJson<MenuImportResult>(url, {
    method: 'POST',
    body: formData,
  });
}

export function createMenuService(factory?: MenuServiceFactory): MenuService {
  try {
    return factory ? factory() : new DefaultMenuService();
  } catch (error) {
    console.error('[ops][menu] failed to instantiate service', error);
    return new NotImplementedMenuService();
  }
}
