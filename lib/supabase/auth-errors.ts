export type SupabaseAuthErrorLike = {
  message?: string | null;
  code?: string | null;
  name?: string | null;
  status?: number | null;
};

/**
 * Sign-out should be idempotent. These errors indicate the user is already signed out
 * or the refresh/session token is no longer present.
 */
export function isMissingSessionAuthError(error: SupabaseAuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  return (
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("refresh token not found") ||
    code === "session_missing" ||
    code === "refresh_token_not_found"
  );
}

