
import { DEV_RESTAURANT_ID } from '../devIds';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { TeamInvite, TeamInviteStatus, TeamService } from '@/services/ops/team';




type MutableInvite = TeamInvite & { restaurantId: string };

function nowIso() {
  return new Date().toISOString();
}

function seedInvites(): MutableInvite[] {
  return [
    {
      id: 'invite-1',
      restaurant_id: DEV_RESTAURANT_ID,
      restaurantId: DEV_RESTAURANT_ID,
      email: 'host@example.com',
      role: 'host' as RestaurantRole,
      status: 'pending',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as unknown as MutableInvite,
    {
      id: 'invite-2',
      restaurant_id: DEV_RESTAURANT_ID,
      restaurantId: DEV_RESTAURANT_ID,
      email: 'manager.with.a.very.long.email.alias+wrap@example-very-long-domain.test',
      role: 'manager' as RestaurantRole,
      status: 'accepted',
      created_at: nowIso(),
      expires_at: null,
    } as unknown as MutableInvite,
  ];
}

export class DevTeamService implements TeamService {
  private invites: MutableInvite[];

  constructor() {
    this.invites = seedInvites();
  }

  async listInvites(restaurantId: string, status: TeamInviteStatus = 'pending'): Promise<TeamInvite[]> {
    if (restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][teamService] unknown restaurant');
    }
    const list = this.invites.filter((i) => i.restaurantId === restaurantId);
    if (status === 'all') return list;
    return list.filter((i) => (i as unknown as { status?: string }).status === status);
  }

  async createInvite(input: { restaurantId: string; email: string; role: RestaurantRole; expiresAt?: string }) {
    if (input.restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][teamService] unknown restaurant');
    }
    const invite: MutableInvite = {
      id: `invite-${Date.now()}`,
      restaurant_id: input.restaurantId,
      restaurantId: input.restaurantId,
      email: input.email,
      role: input.role,
      status: 'pending',
      created_at: nowIso(),
      expires_at: input.expiresAt ?? null,
    } as unknown as MutableInvite;
    this.invites = [invite, ...this.invites];
    return { invite, emailSent: true };
  }

  async resendInvite(input: { restaurantId: string; inviteId: string }) {
    if (input.restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][teamService] unknown restaurant');
    }
    const existing = this.invites.find((i) => i.id === input.inviteId);
    if (!existing || (existing as unknown as { status?: string }).status !== 'pending') {
      throw new Error('[dev][teamService] invite is not pending');
    }
    const resent = { ...existing, updated_at: nowIso() } as unknown as MutableInvite;
    this.invites = this.invites.map((i) => (i.id === input.inviteId ? resent : i));
    return { invite: resent, emailSent: true };
  }

  async revokeInvite(input: { restaurantId: string; inviteId: string }) {
    if (input.restaurantId !== DEV_RESTAURANT_ID) {
      throw new Error('[dev][teamService] unknown restaurant');
    }
    const idx = this.invites.findIndex((i) => i.id === input.inviteId);
    if (idx === -1) {
      throw new Error('[dev][teamService] invite not found');
    }
    const existing = this.invites[idx]!;
    const revoked = {
      ...existing,
      status: 'revoked',
    } as unknown as MutableInvite;
    this.invites = this.invites.map((i) => (i.id === input.inviteId ? revoked : i));
    return revoked;
  }
}

export function createDevTeamService(): TeamService {
  return new DevTeamService();
}

