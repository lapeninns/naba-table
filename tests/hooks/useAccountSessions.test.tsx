import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useLogOutOtherAccountSessions } from '@/hooks/useAccountSessions';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

describe('useLogOutOtherAccountSessions', () => {
  it('logs out other sessions and refreshes the session list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createQueryWrapper(queryClient);
    vi.mocked(fetchJson).mockResolvedValue({ status: 'ok' });

    const { result } = renderHook(() => useLogOutOtherAccountSessions(), { wrapper });

    await result.current.mutateAsync();

    expect(fetchJson).toHaveBeenCalledWith('/api/account/sessions', { method: 'DELETE' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.account.sessions() });
  });
});
