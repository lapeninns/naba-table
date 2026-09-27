import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsDashboardQueryState } from '@/components/features/dashboard/useOpsDashboardQueryState';

import type { ChangeEvent } from 'react';

const navigation = vi.hoisted(() => {
  // Like Next, return the same URLSearchParams object until the URL changes.
  const cache = new Map<string, URLSearchParams>();
  const replace = vi.fn<(url: string) => void>();
  const router = { replace };
  return {
    search: '',
    replace,
    router,
    params(search: string) {
      if (!cache.has(search)) cache.set(search, new URLSearchParams(search));
      return cache.get(search)!;
    },
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/print',
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params(navigation.search),
}));

const typed = (value: string) => ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

describe('useOpsDashboardQueryState', () => {
  beforeEach(() => {
    navigation.search = 'date=2026-05-16&filter=attention';
    navigation.replace.mockReset();
  });

  it('@contract keeps typed search when an earlier filter change lands in the URL', async () => {
    const { result, rerender } = renderHook(() =>
      useOpsDashboardQueryState({ initialDate: '2026-05-16' }),
    );

    act(() => result.current.handleSelectFilter('all'));
    act(() => result.current.handleSearchChange(typed('sharma')));

    // The filter change's router.replace lands after the guest name was typed.
    navigation.search = 'date=2026-05-16';
    rerender();

    expect(result.current.searchQuery).toBe('sharma');
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenLastCalledWith(
        '/dashboard/print?date=2026-05-16&search=sharma',
      ),
    );
  });

  it('@contract follows the URL when search changes from outside, such as back navigation', () => {
    navigation.search = 'date=2026-05-16&search=alex';
    const { result, rerender } = renderHook(() =>
      useOpsDashboardQueryState({ initialDate: '2026-05-16' }),
    );
    expect(result.current.searchQuery).toBe('alex');

    navigation.search = 'date=2026-05-16&search=sam';
    rerender();
    expect(result.current.searchQuery).toBe('sam');
  });

  it('@contract clears filter and search together', () => {
    navigation.search = 'date=2026-05-16&filter=seated&search=alex';
    const { result } = renderHook(() => useOpsDashboardQueryState({ initialDate: '2026-05-16' }));

    act(() => result.current.handleClearFilters());

    expect(result.current.filter).toBe('all');
    expect(result.current.searchQuery).toBe('');
    expect(navigation.replace).toHaveBeenLastCalledWith('/dashboard/print?date=2026-05-16');
  });
});
