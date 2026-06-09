import { DEV_RESTAURANT_ID } from './devIds';

import type { OpsMembership, OpsUser } from '@/types/ops';

export const DEV_USER: OpsUser = {
  id: 'dev-user',
  email: 'dev.ops@example.com',
};

export const DEV_MEMBERSHIPS: OpsMembership[] = [
  {
    restaurantId: DEV_RESTAURANT_ID,
    restaurantName: 'Dev Restaurant (Ops Harness)',
    restaurantSlug: 'dev-restaurant',
    role: 'owner',
    createdAt: new Date().toISOString(),
  },
  {
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantName: 'Second Dev Restaurant',
    restaurantSlug: 'second-dev-restaurant',
    role: 'manager',
    createdAt: new Date().toISOString(),
  },
];

export { DEV_RESTAURANT_ID };
