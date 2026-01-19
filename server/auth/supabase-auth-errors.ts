type SupabaseAuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

export type SupabaseAuthFailure = {
  status: 401 | 500;
  code: "UNAUTHENTICATED" | "SESSION_RESOLUTION_FAILED";
  message: string;
};

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as SupabaseAuthErrorLike).status;
  return typeof status === "number" ? status : null;
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as SupabaseAuthErrorLike).message;
  return typeof message === "string" ? message : "";
}

export function mapSupabaseAuthError(error: unknown): SupabaseAuthFailure {
  const status = getErrorStatus(error);
  if (status === 400 || status === 401 || status === 403) {
    return {
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    };
  }

  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("invalid jwt") || message.includes("jwt expired") || message.includes("jwt") || message.includes("unauthorized")) {
    return {
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    };
  }

  return {
    status: 500,
    code: "SESSION_RESOLUTION_FAILED",
    message: "Unable to verify session",
  };
}

