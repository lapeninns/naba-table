import type { SupabaseSessionState } from "@/hooks/useSupabaseSession";

type Listener = (state: SupabaseSessionState) => void;

let snapshot: SupabaseSessionState = { session: null, user: null, status: "loading" };
const listeners = new Set<Listener>();

export function getSupabaseSessionSnapshot(): SupabaseSessionState {
  return snapshot;
}

export function subscribeToSupabaseSession(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function setSupabaseSessionSnapshot(next: SupabaseSessionState): void {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}
