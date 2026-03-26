import { normalizeEmail } from '@/server/customers';
import { getServiceSupabaseClient } from '@/server/supabase';

type ProfileEmailRow = {
  id: string;
  email: string | null;
};

type UserProfileSuppressionRow = {
  id: string;
  is_email_suppressed: boolean | null;
};

async function getProfilesByEmails(emails: string[]): Promise<ProfileEmailRow[]> {
  if (emails.length === 0) {
    return [];
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('id, email').in('email', emails);

  if (error) {
    throw new Error(`Failed to resolve recipient profiles: ${error.message}`);
  }

  return ((data ?? []) as ProfileEmailRow[]).filter(
    (row) => typeof row.id === 'string' && row.id.length > 0 && typeof row.email === 'string' && row.email.length > 0,
  );
}

async function getProfileIdsByEmail(email: string): Promise<string[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const profiles = await getProfilesByEmails([normalizedEmail]);
  return profiles.map((profile) => profile.id);
}

async function getUserProfileSuppressionRows(profileIds: string[]): Promise<UserProfileSuppressionRow[]> {
  if (profileIds.length === 0) {
    return [];
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, is_email_suppressed')
    .in('id', profileIds);

  if (error) {
    throw new Error(`Failed to resolve recipient suppression state: ${error.message}`);
  }

  return (data ?? []) as UserProfileSuppressionRow[];
}

export async function getSuppressedRecipientEmails(recipients: string[]): Promise<string[]> {
  const normalizedRecipients = [...new Set(recipients.map((value) => normalizeEmail(value)).filter(Boolean))];

  if (normalizedRecipients.length === 0) {
    return [];
  }

  const profiles = await getProfilesByEmails(normalizedRecipients);
  if (profiles.length === 0) {
    return [];
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, normalizeEmail(profile.email)]));
  const suppressionRows = await getUserProfileSuppressionRows(Array.from(profilesById.keys()));
  const suppressedIds = new Set(
    suppressionRows
      .filter((row) => row.is_email_suppressed === true)
      .map((row) => row.id),
  );

  return [...new Set(
    Array.from(suppressedIds)
      .map((id) => profilesById.get(id))
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )];
}

export async function suppressProfilesByEmail(email: string): Promise<{ matchedProfiles: number; updatedProfiles: number }> {
  const profileIds = await getProfileIdsByEmail(email);
  if (profileIds.length === 0) {
    return { matchedProfiles: 0, updatedProfiles: 0 };
  }

  const suppressionRows = await getUserProfileSuppressionRows(profileIds);
  const idsToUpdate = suppressionRows
    .filter((row) => row.is_email_suppressed !== true)
    .map((row) => row.id);

  if (idsToUpdate.length === 0) {
    return { matchedProfiles: profileIds.length, updatedProfiles: 0 };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_email_suppressed: true, updated_at: new Date().toISOString() })
    .in('id', idsToUpdate);

  if (error) {
    throw new Error(`Failed to update suppression flag: ${error.message}`);
  }

  return {
    matchedProfiles: profileIds.length,
    updatedProfiles: idsToUpdate.length,
  };
}
