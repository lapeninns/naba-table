import type { SupabaseClient, User } from "@supabase/supabase-js";

import { profileResponseSchema } from "@/lib/profile/schema";
import type { Database } from "@/types/supabase";

export const PROFILE_COLUMNS = "id,name,email,phone,image,created_at,updated_at" as const;

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileRecord = Pick<
  ProfileRow,
  "id" | "name" | "email" | "phone" | "image" | "created_at" | "updated_at"
>;

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

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

function resolveDefaultProfileInsert(user: User): ProfileInsert & { id: string } {
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

  return {
    id: user.id,
    email,
    name: rawName,
    phone: rawPhone,
    image: rawImage,
  };
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
    return data;
  }

  const insertPayload = resolveDefaultProfileInsert(user);

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
