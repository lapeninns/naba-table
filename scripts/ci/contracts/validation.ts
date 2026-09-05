import { z } from 'zod';

import { findCredentialLikeKeys } from './credential-guard';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export class ContractValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(contract: string, issues: readonly ValidationIssue[]) {
    super(
      `${contract} failed validation:\n${issues
        .map((issue) => `  - ${issue.path || '<root>'}: ${issue.message}`)
        .join('\n')}`,
    );
    this.name = 'ContractValidationError';
    this.issues = issues;
  }
}

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

export function validateWith<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, issues: toValidationIssues(parsed.error) };
}

export function assertWith<T>(schema: z.ZodType<T>, input: unknown, contract: string): T {
  const result = validateWith(schema, input);
  if (!result.ok) {
    throw new ContractValidationError(contract, result.issues);
  }
  return result.value;
}

/** JSON Schema (draft 2020-12) projection of a contract, for cross-language consumers. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>;
}

/**
 * Zod refinement that rejects any credential-looking key anywhere inside the
 * payload. Attach with `.superRefine(rejectCredentialLikeKeys)`.
 */
export function rejectCredentialLikeKeys(value: unknown, ctx: z.RefinementCtx): void {
  for (const path of findCredentialLikeKeys(value)) {
    ctx.addIssue({
      code: 'custom',
      message: `credential-like key is not allowed in this contract: ${path}`,
      path: path.split('.'),
    });
  }
}

export function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}
