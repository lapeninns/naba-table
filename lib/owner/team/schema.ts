import { z } from "zod";

import { RESTAURANT_ROLE_OPTIONS, RESTAURANT_ROLES } from "@/lib/owner/auth/roles";

export const restaurantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  slug: z.string().nullable(),
});

export const restaurantMembershipSchema = z.object({
  restaurantId: z.string().uuid(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
  restaurant: restaurantSummarySchema,
});

export const restaurantMembershipResponseSchema = z.object({
  memberships: z.array(restaurantMembershipSchema),
});

export const inviteStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);

export const restaurantInviteSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
  status: inviteStatusSchema,
  expiresAt: z.string().datetime({ offset: true }),
  invitedBy: z.string().uuid().nullable(),
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const invitationListResponseSchema = z.object({
  invites: z.array(restaurantInviteSchema),
});

export const invitationCreateResponseSchema = z.object({
  invite: restaurantInviteSchema,
  token: z.string().min(1),
  inviteUrl: z.string().url(),
});

export const invitationCreatePayloadSchema = z.object({
  restaurantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export type RestaurantMembership = z.infer<typeof restaurantMembershipSchema>;
export type RestaurantInvite = z.infer<typeof restaurantInviteSchema>;

export const invitationDetailResponseSchema = z.object({
  invite: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(RESTAURANT_ROLE_OPTIONS),
    status: inviteStatusSchema,
    expiresAt: z.string().datetime({ offset: true }),
    restaurant: z.object({
      id: z.string().uuid(),
      name: z.string().nullable(),
    }),
    inviter: z.string().nullable(),
  }),
});

export const invitationAcceptResponseSchema = z.object({
  success: z.literal(true),
  email: z.string().email(),
  restaurantId: z.string().uuid(),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
});
