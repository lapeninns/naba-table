"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function signOutFromSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
