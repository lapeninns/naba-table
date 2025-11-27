import { fetchJson } from '@/lib/http/fetchJson';
import {
  invitationCreateResponseSchema,
  invitationListResponseSchema,
  restaurantInviteSchema,
  type RestaurantInvite,
} from '@/lib/owner/team/schema';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { OpsServiceError } from '@/types/ops';

const TEAM_INVITES_BASE = '/api/team/invitations';

export type TeamInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired' | 'all';

export type TeamInvite = RestaurantInvite;

export type CreateInviteInput = {
  restaurantId: string;
  email: string;
  role: RestaurantRole;
  expiresAt?: string;
};

export type RevokeInviteInput = {
  restaurantId: string;
  inviteId: string;
};

export interface TeamService {
  listInvites(restaurantId: string, status?: TeamInviteStatus): Promise<TeamInvite[]>;
  createInvite(input: CreateInviteInput): Promise<{ invite: TeamInvite; inviteUrl: string }>;
  revokeInvite(input: RevokeInviteInput): Promise<TeamInvite>;
}

export class NotImplementedTeamService implements TeamService {
  private error(message: string): never {
    throw new Error(`[ops][teamService] ${message}`);
  }

  listInvites(): Promise<TeamInvite[]> {
    this.error('listInvites not implemented');
  }

  createInvite(): Promise<{ invite: TeamInvite; inviteUrl: string }> {
    this.error('createInvite not implemented');
  }

  revokeInvite(): Promise<TeamInvite> {
    this.error('revokeInvite not implemented');
  }
}

export type TeamServiceFactory = () => TeamService;

export function createTeamService(factory?: TeamServiceFactory): TeamService {
  try {
    return factory ? factory() : createBrowserTeamService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][teamService] failed to instantiate', error.message);
    }
    return new NotImplementedTeamService();
  }
}

export type TeamServiceError = OpsServiceError | Error;

export function createBrowserTeamService(): TeamService {
  return {
    async listInvites(restaurantId: string, status: TeamInviteStatus = 'pending') {
      const params = new URLSearchParams({ restaurantId, status });
      const data = await fetchJson<unknown>(`${TEAM_INVITES_BASE}?${params.toString()}`);
      const parsed = invitationListResponseSchema.parse(data);
      return parsed.invites;
    },

    async createInvite(input: CreateInviteInput) {
      const payload = {
        restaurantId: input.restaurantId,
        email: input.email,
        role: input.role,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      };
      const data = await fetchJson<unknown>(TEAM_INVITES_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = invitationCreateResponseSchema.parse(data);
      return {
        invite: parsed.invite,
        inviteUrl: parsed.inviteUrl,
      };
    },

    async revokeInvite({ restaurantId, inviteId }: RevokeInviteInput) {
      const params = new URLSearchParams({ restaurantId });
      const data = await fetchJson<unknown>(`${TEAM_INVITES_BASE}/${inviteId}?${params.toString()}`, {
        method: 'DELETE',
      });
      const parsed = restaurantInviteSchema.parse((data as { invite: unknown }).invite);
      return parsed;
    },
  } satisfies TeamService;
}
