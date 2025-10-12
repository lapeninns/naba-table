import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureProfileRow } from "@/lib/profile/server";
import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database } from "@/types/supabase";
import {
  findInviteByToken,
  inviteHasExpired,
  markInviteAccepted,
  markInviteExpired,
} from "@/server/team/invitations";

type SupabaseAdminClient = SupabaseClient<Database, "public", any>;

const LIST_USERS_PAGE_LIMIT = 100;

async function findAuthUserByEmail(
  admin: SupabaseAdminClient,
  email: string,
): Promise<User | null> {
  let page: number | undefined = undefined;

  while (true) {
    const listUsersOptions =
      page !== undefined
        ? { perPage: LIST_USERS_PAGE_LIMIT, page }
        : { perPage: LIST_USERS_PAGE_LIMIT };

    const { data, error } = await admin.auth.admin.listUsers(listUsersOptions);

    if (error) {
      throw error;
    }

    const users = (data?.users as User[] | undefined) ?? [];
    const match = users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match) {
      return match;
    }

    const pagination = data as { nextPage?: number | string | null } | undefined;
    const rawNextPage = pagination?.nextPage;
    if (typeof rawNextPage === "number" && Number.isFinite(rawNextPage)) {
      page = rawNextPage;
    } else if (typeof rawNextPage === "string") {
      const parsed = Number.parseInt(rawNextPage, 10);
      page = Number.isFinite(parsed) ? parsed : undefined;
    } else {
      page = undefined;
    }

    if (page === undefined) {
      break;
    }
  }

  return null;
}

const paramsSchema = z.object({ token: z.string().min(10) });

const payloadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedPayload = payloadSchema.safeParse(body);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsedPayload.error.flatten() }, { status: 400 });
  }

  try {
    const invite = await findInviteByToken(parsedParams.data.token);

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.status === "revoked") {
      return NextResponse.json({ error: "Invitation revoked" }, { status: 410 });
    }

    if (invite.status === "accepted") {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 409 });
    }

    if (invite.status === "expired" || inviteHasExpired(invite)) {
      if (invite.status === "pending") {
        await markInviteExpired(invite.id);
      }
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    const service = getServiceSupabaseClient() as SupabaseAdminClient;
    const normalizedEmail = invite.email.toLowerCase();
    const metadata = {
      full_name: parsedPayload.data.name,
      name: parsedPayload.data.name,
    } as Record<string, unknown>;
    const existing = await findAuthUserByEmail(service, normalizedEmail);
    let authUser: User;

    if (!existing) {
      const created = await service.auth.admin.createUser({
        email: normalizedEmail,
        password: parsedPayload.data.password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (created.error || !created.data.user) {
        return NextResponse.json({ error: created.error?.message ?? "Unable to create account" }, { status: 500 });
      }

      authUser = created.data.user as User;
    } else {
      const updated = await service.auth.admin.updateUserById(existing.id, {
        password: parsedPayload.data.password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          ...metadata,
        },
      });

      if (updated.error || !updated.data.user) {
        return NextResponse.json({ error: updated.error?.message ?? "Unable to update account" }, { status: 500 });
      }

      authUser = updated.data.user as User;
    }

    await ensureProfileRow(service, authUser);

    await service
      .from("restaurant_memberships")
      .upsert({
        user_id: authUser.id,
        restaurant_id: invite.restaurant_id,
        role: invite.role,
      }, { onConflict: "user_id,restaurant_id" });

    await markInviteAccepted(invite.id);

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      restaurantId: invite.restaurant_id,
      role: invite.role,
    });
  } catch (error) {
    console.error("[api/team/invitations/token/accept][POST] failed", error);
    return NextResponse.json({ error: "Unable to accept invitation" }, { status: 500 });
  }
}
