"use client";

import { useGuestSessionState } from "@/guest/services/di";

export const useGuestSession = () => useGuestSessionState();
