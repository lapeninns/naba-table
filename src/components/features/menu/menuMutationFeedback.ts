import { toast } from 'sonner';

import { HttpError } from '@/lib/http/errors';

/**
 * Safe reason code for a failed menu request. Only the machine code is shown: route errors may
 * carry text that includes guest or menu data.
 */
export function menuErrorReasonCode(error: unknown): string | null {
  return error instanceof HttpError && error.code ? error.code : null;
}

export function withReasonCode(message: string, error: unknown) {
  const code = menuErrorReasonCode(error);
  return code ? `${message} Reason code ${code}.` : message;
}

/**
 * Runs a menu write and reports the outcome. Failures say what did not happen, so a
 * reorder or toggle never fails silently.
 */
export async function runMenuMutation(
  action: () => Promise<unknown>,
  messages: { success?: string; failure: string },
): Promise<boolean> {
  try {
    await action();
    if (messages.success) {
      toast.success(messages.success);
    }
    return true;
  } catch (error) {
    toast.error(withReasonCode(messages.failure, error));
    return false;
  }
}
