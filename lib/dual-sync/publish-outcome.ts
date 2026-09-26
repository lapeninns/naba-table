/**
 * Field keys a dual-sync publish response reports as not applied.
 *
 * `failures` alone is not enough: a replayed request (same clientRequestId) is rebuilt from the
 * stored batch, and an operation can fail without a failure object. Any operation whose status
 * is not `succeeded`/`skipped` counts as failed for its field.
 */
export interface PublishOutcomeLike {
  readonly failures?: ReadonlyArray<{ readonly fieldKey: string }> | null;
  readonly operations?: ReadonlyArray<{
    readonly fieldKey: string;
    readonly status: string;
  }> | null;
}

export function publishFailedFieldKeys(
  response: PublishOutcomeLike | null | undefined,
): Set<string> {
  const failed = new Set<string>();
  if (!response) return failed;
  for (const failure of response.failures ?? []) {
    failed.add(failure.fieldKey);
  }
  for (const operation of response.operations ?? []) {
    if (operation.status !== 'succeeded' && operation.status !== 'skipped') {
      failed.add(operation.fieldKey);
    }
  }
  return failed;
}
