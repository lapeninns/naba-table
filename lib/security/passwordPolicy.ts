import { z } from 'zod';

export const passwordPolicySchema = z
  .string()
  .trim()
  .min(12, 'Use at least 12 characters')
  .max(256, 'Password is too long')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Include at least one symbol');

export function validatePasswordStrength(password: string | undefined) {
  if (!password) {
    return { success: false as const, error: 'Enter your password' };
  }

  const result = passwordPolicySchema.safeParse(password);
  if (result.success) {
    return { success: true as const, value: result.data };
  }

  const message = result.error.issues[0]?.message ?? 'Password does not meet requirements';
  return { success: false as const, error: message };
}

export function validatePasswordForSignIn(password: string | undefined) {
  if (typeof password !== 'string' || password.length === 0) {
    return { success: false as const, error: 'Enter your password' };
  }

  return { success: true as const, value: password };
}
