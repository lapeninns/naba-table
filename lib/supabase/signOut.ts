"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function signOutFromSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  try {
    const response = await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      console.error("[signOut] Server signout failed");
    }
  } catch (error) {
    console.error("[signOut] Server signout error", error);
  }
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
