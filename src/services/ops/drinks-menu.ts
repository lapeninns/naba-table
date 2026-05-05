import { fetchJson } from '@/lib/http/fetchJson';

import type {
  DrinkImportResult,
  DrinkItemDetail,
  DrinkItemUpsertInput,
  DrinkListFilters,
  DrinkListResponse,
} from '@/server/drinks-menu/types';

const buildDrinkItemsBase = (restaurantId: string) =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/drinks/items`;

const buildDrinkImportBase = (restaurantId: string) =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/drinks/import`;

type DrinkItemResponse = {
  item: DrinkItemDetail;
};

export type DrinkMenuImportPayload = {
  itemsFile: File;
  modifierGroupsFile?: File | null;
  modifierOptionsFile?: File | null;
};

export interface DrinkMenuService {
  listItems(restaurantId: string, filters?: DrinkListFilters): Promise<DrinkListResponse>;
  getItem(restaurantId: string, itemId: string): Promise<DrinkItemDetail>;
  createItem(restaurantId: string, payload: DrinkItemUpsertInput): Promise<DrinkItemDetail>;
  updateItem(restaurantId: string, itemId: string, payload: DrinkItemUpsertInput): Promise<DrinkItemDetail>;
  previewImport(restaurantId: string, payload: DrinkMenuImportPayload): Promise<DrinkImportResult>;
  applyImport(restaurantId: string, payload: DrinkMenuImportPayload): Promise<DrinkImportResult>;
}

export type DrinkMenuServiceFactory = () => DrinkMenuService;

class DefaultDrinkMenuService implements DrinkMenuService {
  async listItems(restaurantId: string, filters: DrinkListFilters = {}): Promise<DrinkListResponse> {
    const searchParams = new URLSearchParams();
    if (filters.search) searchParams.set('search', filters.search);
    if (filters.category) searchParams.set('category', filters.category);
    if (filters.subcategory) searchParams.set('subcategory', filters.subcategory);
    if (filters.status && filters.status !== 'all') searchParams.set('status', filters.status);

    const query = searchParams.toString();
    return fetchJson<DrinkListResponse>(`${buildDrinkItemsBase(restaurantId)}${query ? `?${query}` : ''}`);
  }

  async getItem(restaurantId: string, itemId: string): Promise<DrinkItemDetail> {
    const response = await fetchJson<DrinkItemResponse>(`${buildDrinkItemsBase(restaurantId)}/${encodeURIComponent(itemId)}`);
    return response.item;
  }

  async createItem(restaurantId: string, payload: DrinkItemUpsertInput): Promise<DrinkItemDetail> {
    const response = await fetchJson<DrinkItemResponse>(buildDrinkItemsBase(restaurantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.item;
  }

  async updateItem(restaurantId: string, itemId: string, payload: DrinkItemUpsertInput): Promise<DrinkItemDetail> {
    const response = await fetchJson<DrinkItemResponse>(`${buildDrinkItemsBase(restaurantId)}/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.item;
  }

  async previewImport(restaurantId: string, payload: DrinkMenuImportPayload): Promise<DrinkImportResult> {
    return postImport(buildDrinkImportBase(restaurantId), payload, 'preview');
  }

  async applyImport(restaurantId: string, payload: DrinkMenuImportPayload): Promise<DrinkImportResult> {
    return postImport(buildDrinkImportBase(restaurantId), payload, 'apply');
  }
}

class NotImplementedDrinkMenuService implements DrinkMenuService {
  private error(message: string): never {
    throw new Error(`[ops][drinks] ${message}`);
  }

  listItems(): Promise<DrinkListResponse> {
    this.error('listItems not implemented');
  }

  getItem(): Promise<DrinkItemDetail> {
    this.error('getItem not implemented');
  }

  createItem(): Promise<DrinkItemDetail> {
    this.error('createItem not implemented');
  }

  updateItem(): Promise<DrinkItemDetail> {
    this.error('updateItem not implemented');
  }

  previewImport(): Promise<DrinkImportResult> {
    this.error('previewImport not implemented');
  }

  applyImport(): Promise<DrinkImportResult> {
    this.error('applyImport not implemented');
  }
}

async function postImport(
  url: string,
  payload: DrinkMenuImportPayload,
  mode: 'preview' | 'apply',
): Promise<DrinkImportResult> {
  const formData = new FormData();
  formData.set('mode', mode);
  formData.set('items', payload.itemsFile);
  if (payload.modifierGroupsFile) {
    formData.set('modifierGroups', payload.modifierGroupsFile);
  }
  if (payload.modifierOptionsFile) {
    formData.set('modifierOptions', payload.modifierOptionsFile);
  }

  return fetchJson<DrinkImportResult>(url, {
    method: 'POST',
    body: formData,
  });
}

export function createDrinkMenuService(factory?: DrinkMenuServiceFactory): DrinkMenuService {
  try {
    return factory ? factory() : new DefaultDrinkMenuService();
  } catch (error) {
    console.error('[ops][drinks] failed to instantiate service', error);
    return new NotImplementedDrinkMenuService();
  }
}
