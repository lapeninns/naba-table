import { getFieldErrors } from '@/lib/http/userMessage';

import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

/**
 * Puts server field messages (C1 `fields`, dot paths such as `tables.2.tableNumber`) on the
 * matching form inputs. `accept` is a list of field names, or a predicate for array paths.
 * Returns true when at least one message was applied.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  accept: ReadonlyArray<Path<T>> | ((name: string) => boolean),
): boolean {
  const fields = getFieldErrors(error);
  if (!fields) return false;
  const isAccepted =
    typeof accept === 'function' ? accept : (name: string) => accept.includes(name as Path<T>);
  let applied = false;
  for (const [name, messages] of Object.entries(fields)) {
    const message = messages[0];
    if (message && isAccepted(name)) {
      form.setError(name as Path<T>, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}

/** Server field messages under `prefix.<index>.<field>`, keyed by `<index>.<field>`. */
export function serverFieldMessages(error: unknown, prefix: string): Record<string, string> {
  const fields = getFieldErrors(error);
  const messages: Record<string, string> = {};
  if (!fields) return messages;
  for (const [name, list] of Object.entries(fields)) {
    if (name.startsWith(`${prefix}.`) && list[0]) {
      messages[name.slice(prefix.length + 1)] = list[0];
    }
  }
  return messages;
}
