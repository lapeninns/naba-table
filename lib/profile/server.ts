
import {
  profileNameSchema,
  profilePhoneSchema,
  profileResponseSchema,
} from "@/lib/profile/schema";
import { normalizeEmail } from "@/server/customers";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const PROFILE_COLUMNS = "id,name,email,phone,image,created_at,updated_at" as const;

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileRecord = Pick<
  ProfileRow,
  "id" | "name" | "email" | "phone" | "image" | "created_at" | "updated_at"
>;

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type CustomerContactRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "full_name" | "phone" | "updated_at" | "created_at"
>;

function toIsoString(value: string | null | undefined, fallback: () => string): string {
  if (!value) {
    return fallback();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback();
  }

  return date.toISOString();
}

export function normalizeProfileRow(row: ProfileRecord, fallbackEmail: string | null) {
  const email = typeof row.email === "string" && row.email.length > 0 ? row.email : fallbackEmail;
  if (!email) {
    throw new Error("Profile row missing email value");
  }

  const name = typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : null;
  const phone = typeof row.phone === "string" && row.phone.trim().length > 0 ? row.phone.trim() : null;
  const image = typeof row.image === "string" && row.image.trim().length > 0 ? row.image.trim() : null;
  const createdAt = toIsoString(row.created_at, () => new Date().toISOString());
  const updatedAt = toIsoString(row.updated_at, () => createdAt);

  return profileResponseSchema.parse({
    id: row.id,
    email,
    name,
    phone,
    image,
    createdAt,
    updatedAt,
  });
}

function sanitizeName(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = profileNameSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

function sanitizePhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = profilePhoneSchema.safeParse(trimmed);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

async function fetchLatestCustomerContact(email: string): Promise<CustomerContactRow | null> {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await service
    .from("customers")
    .select("full_name,phone,updated_at,created_at")
    .eq("email_normalized", normalizedEmail)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    console.error("[profile][hydrate] failed to fetch customer contact", { email, error });
    return null;
  }

  const contact = Array.isArray(data) ? (data[0] as CustomerContactRow | undefined) : null;
  return contact ?? null;
}

async function hydrateProfileInsertFromCustomers(
  base: ProfileInsert & { id: string },
): Promise<ProfileInsert & { id: string }> {
  const next = { ...base };

  if (!next.email || (next.name && next.phone)) {
    return next;
  }

  const contact = await fetchLatestCustomerContact(next.email);
  if (!contact) {
    return next;
  }

  if (!next.name) {
    const candidate = sanitizeName(contact.full_name);
    if (candidate) {
      next.name = candidate;
    }
  }

  if (!next.phone) {
    const candidate = sanitizePhone(contact.phone);
    if (candidate) {
      next.phone = candidate;
    }
  }

  return next;
}

async function resolveDefaultProfileInsert(user: User): Promise<ProfileInsert & { id: string }> {
  const email = typeof user.email === "string" && user.email.length > 0 ? user.email : null;

  const metadata = user.user_metadata ?? {};
  const rawName =
    typeof metadata.full_name === "string" && metadata.full_name.trim().length > 0
      ? metadata.full_name
      : typeof metadata.name === "string" && metadata.name.trim().length > 0
        ? metadata.name
        : null;

  const rawPhone =
    typeof metadata.phone_number === "string" && metadata.phone_number.trim().length > 0
      ? metadata.phone_number
      : null;

  const rawImage =
    typeof metadata.avatar_url === "string" && metadata.avatar_url.trim().length > 0
      ? metadata.avatar_url
      : typeof metadata.picture === "string" && metadata.picture.trim().length > 0
        ? metadata.picture
        : null;

  const base: ProfileInsert & { id: string } = {
    id: user.id,
    email,
    name: rawName,
    phone: rawPhone,
    image: rawImage,
  };

  return await hydrateProfileInsertFromCustomers(base);
}

export async function ensureProfileRow(
  client: SupabaseClient<Database, "public", any>,
  user: User,
): Promise<ProfileRecord> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (error) {
    throw error;
  }

  if (data) {
    const existing = data as ProfileRecord;
    const needsName = !existing.name || existing.name.trim().length === 0;
    const needsPhone = !existing.phone || existing.phone.trim().length === 0;

    if (!needsName && !needsPhone) {
      return existing;
    }

    const lookupEmail =
      (typeof existing.email === "string" && existing.email.length > 0
        ? existing.email
        : user.email) ?? null;

    if (!lookupEmail) {
      return existing;
    }

    const hydrated = await hydrateProfileInsertFromCustomers({
      id: existing.id,
      email: lookupEmail,
      name: existing.name,
      phone: existing.phone,
      image: existing.image,
    });

    const updates: Partial<ProfileInsert> & { updated_at?: string } = {};

    if (needsName && hydrated.name && hydrated.name !== existing.name) {
      updates.name = hydrated.name;
    }
    if (needsPhone && hydrated.phone && hydrated.phone !== existing.phone) {
      updates.phone = hydrated.phone;
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    updates.updated_at = new Date().toISOString();

    const { data: patched, error: updateError } = await client
      .from("profiles")
      .update(updates)
      .eq("id", existing.id)
      .select(PROFILE_COLUMNS)
      .single<ProfileRecord>();

    if (updateError) {
      console.error("[profile][hydrate] failed to update profile with customer contact", {
        profileId: existing.id,
        error: updateError,
      });
      return existing;
    }

    return patched ?? existing;
  }

  const insertPayload = await resolveDefaultProfileInsert(user);

  const { data: inserted, error: insertError } = await client
    .from("profiles")
    .upsert(insertPayload, { onConflict: "id" })
    .select(PROFILE_COLUMNS)
    .single<ProfileRecord>();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

export async function getOrCreateProfile(
  client: SupabaseClient<Database, "public", any>,
  user: User,
) {
  const row = await ensureProfileRow(client, user);
  return normalizeProfileRow(row, user.email ?? null);
}
