"use client";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export const useGuestSession = () => useSupabaseSession();
