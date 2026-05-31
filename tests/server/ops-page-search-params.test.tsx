import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/customers/OpsCustomersClient', () => ({
  OpsCustomersClient: () => null,
}));

vi.mock('@/components/features/email-delivery/OpsEmailDeliveryClient', () => ({
  OpsEmailDeliveryClient: () => null,
}));

import OpsCustomersPage from '@/src/app/app/(app)/customers/page';
import OpsEmailDeliveryPage from '@/src/app/app/(app)/email-delivery/page';

describe('ops page search param normalization', () => {
  it('uses the first duplicate focus param for customers instead of passing an array', async () => {
    const element = await OpsCustomersPage({
      searchParams: Promise.resolve({ focus: ['Guest@One.test', 'Guest@Two.test'] }),
    });

    expect(element.props.focusCustomer).toBe('Guest@One.test');
  });

  it('uses first duplicate email delivery params before string parsing', async () => {
    const element = await OpsEmailDeliveryPage({
      searchParams: Promise.resolve({
        tab: ['queue', 'analytics'],
        status: ['sent,failed', 'queued'],
        page: ['2', '3'],
        pageSize: ['25', '200'],
        simulateEmailDeliveryError: ['1', '0'],
      }),
    });

    expect(element.props.initialTab).toBe('queue');
    expect(element.props.initialStatuses).toEqual(['sent', 'failed']);
    expect(element.props.initialPage).toBe(2);
    expect(element.props.initialPageSize).toBe(25);
    expect(element.props.initialSimulateEmailDeliveryError).toBe(true);
  });
});
