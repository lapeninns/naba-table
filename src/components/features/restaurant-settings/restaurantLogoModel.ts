export const LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export type LogoValidationError = {
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE';
  message: string;
};

export type LogoAnalyticsEvent =
  | 'restaurant_profile_logo_validation_error'
  | 'restaurant_profile_logo_saved'
  | 'restaurant_profile_logo_save_failed';

export function validateLogoFile(file: Pick<File, 'size' | 'type'>): LogoValidationError | null {
  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return {
      code: 'FILE_TOO_LARGE',
      message: 'Images must be 2 MB or smaller.',
    };
  }

  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      code: 'UNSUPPORTED_FILE',
      message: 'Supported formats: JPEG, PNG, WEBP, SVG.',
    };
  }

  return null;
}

export function extractLogoInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('')
    .padEnd(2, '•');
}
