import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireCronAuthAndRunMock = vi.hoisted(() => vi.fn());
const getEmailQueueStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/cron-auth', () => ({
  requireCronAuthAndRun: requireCronAuthAndRunMock,
}));

vi.mock('@/server/feature-flags', () => ({
  isEmailQueueEnabled: vi.fn(() => true),
}));

vi.mock('@/server/queue/email', () => ({
  getEmailQueueStatus: getEmailQueueStatusMock,
}));

import { GET } from '@/src/app/api/admin/queue-status/route';

describe('admin queue status route', () => {
  beforeEach(() => {
    requireCronAuthAndRunMock.mockReset();
    getEmailQueueStatusMock.mockReset();
  });

  it('uses the central cron auth and rate-limit guard', async () => {
    requireCronAuthAndRunMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const request = new NextRequest('https://app.nabatable.com/api/admin/queue-status');
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(requireCronAuthAndRunMock).toHaveBeenCalledWith(
      request,
      'admin.queue-status',
      expect.any(Function),
    );
    expect(getEmailQueueStatusMock).not.toHaveBeenCalled();
  });
});
