import { z } from 'zod';

import { fetchJson, type RequestSignalOptions } from '@/lib/http/fetchJson';
import {
  invitationCreateResponseSchema,
  invitationListResponseSchema,
  restaurantInviteSchema,
  type RestaurantInvite,
} from '@/lib/owner/team/schema';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { OpsServiceError } from '@/types/ops';

const TEAM_INVITES_BASE = '/api/ops/team/invitations';

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

export type ResendInviteInput = RevokeInviteInput;

/**
 * `emailSent: false` means the invite exists but its email didn't go out; it can be resent.
 * Older servers omit the flag, which means the email was sent.
 */
export type TeamInviteMutationResult = { invite: TeamInvite; emailSent: boolean };

const inviteMutationResponseSchema = invitationCreateResponseSchema.extend({
  emailSent: z.boolean().optional(),
});

function toMutationResult(data: unknown): TeamInviteMutationResult {
  const parsed = inviteMutationResponseSchema.parse(data);
  return { invite: parsed.invite, emailSent: parsed.emailSent ?? true };
}

export interface TeamService {
  listInvites(
    restaurantId: string,
    status?: TeamInviteStatus,
    options?: RequestSignalOptions,
  ): Promise<TeamInvite[]>;
  createInvite(input: CreateInviteInput): Promise<TeamInviteMutationResult>;
  revokeInvite(input: RevokeInviteInput): Promise<TeamInvite>;
  resendInvite(input: ResendInviteInput): Promise<TeamInviteMutationResult>;
}

export class NotImplementedTeamService implements TeamService {
  private error(message: string): never {
    throw new Error(`[ops][teamService] ${message}`);
  }

  listInvites(): Promise<TeamInvite[]> {
    this.error('listInvites not implemented');
  }

  createInvite(): Promise<TeamInviteMutationResult> {
    this.error('createInvite not implemented');
  }

  revokeInvite(): Promise<TeamInvite> {
    this.error('revokeInvite not implemented');
  }

  resendInvite(): Promise<TeamInviteMutationResult> {
    this.error('resendInvite not implemented');
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
    async listInvites(
      restaurantId: string,
      status: TeamInviteStatus = 'pending',
      options?: RequestSignalOptions,
    ) {
      const params = new URLSearchParams({ restaurantId, status });
      const data = await fetchJson<unknown>(`${TEAM_INVITES_BASE}?${params.toString()}`, options);
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
      return toMutationResult(data);
    },

    async revokeInvite({ restaurantId, inviteId }: RevokeInviteInput) {
      const params = new URLSearchParams({ restaurantId });
      const data = await fetchJson<unknown>(
        `${TEAM_INVITES_BASE}/${inviteId}?${params.toString()}`,
        {
          method: 'DELETE',
        },
      );
      const parsed = restaurantInviteSchema.parse((data as { invite: unknown }).invite);
      return parsed;
    },

    async resendInvite({ inviteId }: ResendInviteInput) {
      const data = await fetchJson<unknown>(
        `${TEAM_INVITES_BASE}/${encodeURIComponent(inviteId)}/resend`,
        { method: 'POST' },
      );
      return toMutationResult(data);
    },
  } satisfies TeamService;
}
