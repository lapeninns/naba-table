import { apiError, conflict, forbidden, notFound } from '@/lib/api/errors';

/** C1 responses shared by /api/ops/zones and /api/ops/zones/[id]. */

export function zoneNotFound() {
  return notFound('ZONE_NOT_FOUND', 'Zone not found.');
}

export function zoneRoleForbidden() {
  return forbidden('INSUFFICIENT_ROLE', 'Only owners and managers can change zones.');
}

export function zoneNameBlank() {
  return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', {
    fields: { name: ['Enter a zone name.'] },
  });
}

export function zoneNameTaken() {
  return conflict('ZONE_NAME_TAKEN', 'Another zone already uses that name.');
}

export function zoneInUse() {
  return conflict('ZONE_IN_USE', 'This zone still has tables. Move or delete them first.');
}

export function postgresCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
