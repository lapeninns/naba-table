export type GoogleBusinessProfilePublishMode =
  | 'nabatable_only'
  | 'nabatable_and_google'
  | 'google_only';

export type GoogleBusinessProfilePublishDirectionIntent =
  | 'google_to_nabatable'
  | 'google_to_nabatable_with_google_sync'
  | 'nabatable_to_google';

function createPublishDirectionError(message: string): Error {
  const error = new Error(message);
  error.name = 'GBP_DIRECTION_CONFLICT';
  return error;
}

export function directionIntentForPublishMode(
  mode: GoogleBusinessProfilePublishMode,
): GoogleBusinessProfilePublishDirectionIntent {
  switch (mode) {
    case 'nabatable_and_google':
      return 'google_to_nabatable_with_google_sync';
    case 'google_only':
      return 'nabatable_to_google';
    case 'nabatable_only':
    default:
      return 'google_to_nabatable';
  }
}

export function publishModeForDirectionIntent(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
): GoogleBusinessProfilePublishMode {
  switch (directionIntent) {
    case 'google_to_nabatable_with_google_sync':
      return 'nabatable_and_google';
    case 'nabatable_to_google':
      return 'google_only';
    case 'google_to_nabatable':
    default:
      return 'nabatable_only';
  }
}

export function pushToGoogleForDirectionIntent(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
): boolean {
  return directionIntent !== 'google_to_nabatable';
}

export function normalizePublishDirectionIntent(input: {
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
}): GoogleBusinessProfilePublishDirectionIntent {
  const legacyIntent =
    input.pushToGoogle === undefined
      ? undefined
      : input.pushToGoogle
        ? 'google_to_nabatable_with_google_sync'
        : 'google_to_nabatable';

  if (input.directionIntent && legacyIntent && input.directionIntent !== legacyIntent) {
    throw createPublishDirectionError(
      'Publish direction conflicts with the legacy Google push flag.',
    );
  }

  return input.directionIntent ?? legacyIntent ?? 'google_to_nabatable';
}

export function assertApprovalWorkflowDirectionSupported(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
) {
  if (
    directionIntent === 'google_to_nabatable' ||
    directionIntent === 'google_to_nabatable_with_google_sync' ||
    directionIntent === 'nabatable_to_google'
  ) {
    return;
  }

  throw createPublishDirectionError('Unsupported Google Business Profile publish direction.');
}

export function assertApprovalWorkflowOneWay(
  directionIntent: GoogleBusinessProfilePublishDirectionIntent,
) {
  assertApprovalWorkflowDirectionSupported(directionIntent);
}
