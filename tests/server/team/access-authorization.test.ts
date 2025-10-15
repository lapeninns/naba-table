import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireMembershipForRestaurant,
  requireAdminMembership,
} from '@/server/team/access';
import { RESTAURANT_ROLES, RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

describe('requireMembershipForRestaurant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow user with valid membership', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'server',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    const membership = await requireMembershipForRestaurant({
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      client: mockClient as any,
    });

    expect(membership).toBeDefined();
    expect(membership.role).toBe('server');
    expect(membership.restaurant_id).toBe('restaurant-123');
  });

  it('should throw MEMBERSHIP_NOT_FOUND if user has no membership', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    await expect(
      requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      }),
    ).rejects.toThrow('Membership not found');

    try {
      await requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      });
    } catch (error: any) {
      expect(error.code).toBe('MEMBERSHIP_NOT_FOUND');
    }
  });

  it('should throw MEMBERSHIP_ROLE_DENIED if role not in allowedRoles', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'server',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    await expect(
      requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        allowedRoles: ['owner', 'manager'], // Server not in allowed roles
        client: mockClient as any,
      }),
    ).rejects.toThrow('Insufficient permissions');

    try {
      await requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        allowedRoles: ['owner', 'manager'],
        client: mockClient as any,
      });
    } catch (error: any) {
      expect(error.code).toBe('MEMBERSHIP_ROLE_DENIED');
      expect(error.role).toBe('server');
    }
  });

  it('should log auth failures with context', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    try {
      await requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      });
    } catch (error) {
      // Expected to throw
    }

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth:membership]'),
      expect.objectContaining({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        requiredRoles: expect.any(Array),
        timestamp: expect.any(String),
      }),
    );

    consoleWarnSpy.mockRestore();
  });

  it('should allow any role if allowedRoles includes all roles', async () => {
    const roles = RESTAURANT_ROLES;

    for (const role of roles) {
      const mockClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: 'user-123',
            restaurant_id: 'restaurant-123',
            role,
            created_at: new Date().toISOString(),
            restaurants: {
              id: 'restaurant-123',
              name: 'Test Restaurant',
              slug: 'test-restaurant',
            },
          },
          error: null,
        }),
      };

      const membership = await requireMembershipForRestaurant({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      });

      expect(membership.role).toBe(role);
    }
  });
});

describe('requireAdminMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow owner role', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'owner',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    const membership = await requireAdminMembership({
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      client: mockClient as any,
    });

    expect(membership).toBeDefined();
    expect(membership.role).toBe('owner');
  });

  it('should allow admin role', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'manager',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    const membership = await requireAdminMembership({
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      client: mockClient as any,
    });

    expect(membership).toBeDefined();
    expect(membership.role).toBe('manager');
  });

  it('should deny staff role', async () => {
    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'server',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    await expect(
      requireAdminMembership({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      }),
    ).rejects.toThrow('Insufficient permissions');

    try {
      await requireAdminMembership({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      });
    } catch (error: any) {
      expect(error.code).toBe('MEMBERSHIP_ROLE_DENIED');
      expect(error.role).toBe('server');
    }
  });

  it('should log role denial with actual role', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          restaurant_id: 'restaurant-123',
          role: 'server',
          created_at: new Date().toISOString(),
          restaurants: {
            id: 'restaurant-123',
            name: 'Test Restaurant',
            slug: 'test-restaurant',
          },
        },
        error: null,
      }),
    };

    try {
      await requireAdminMembership({
        userId: 'user-123',
        restaurantId: 'restaurant-123',
        client: mockClient as any,
      });
    } catch (error) {
      // Expected to throw
    }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[auth:role]'),
        expect.objectContaining({
          userId: 'user-123',
          restaurantId: 'restaurant-123',
          requiredRoles: RESTAURANT_ADMIN_ROLES,
          actualRole: 'server',
          timestamp: expect.any(String),
        }),
      );

    consoleWarnSpy.mockRestore();
  });
});
