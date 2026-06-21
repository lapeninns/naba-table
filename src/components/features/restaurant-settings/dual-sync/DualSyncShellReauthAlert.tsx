import { PersistentGbpErrorAlert } from '../google-business-profile/sections/PersistentGbpErrorAlert';

interface DualSyncShellReauthAlertProps {
  readonly isActionPending: boolean;
  readonly onReconnect: () => void;
}

export function DualSyncShellReauthAlert({
  isActionPending,
  onReconnect,
}: DualSyncShellReauthAlertProps) {
  return (
    <div className="sticky top-0 z-20 shadow-md">
      <PersistentGbpErrorAlert
        error={{
          kind: 'authorization',
          title: 'Google OAuth session expired',
          message:
            'Your Google Business Profile connection has expired. Please reconnect to resume importing or exporting listings.',
        }}
        actionLabel="Reconnect Google"
        onAction={onReconnect}
        isActionPending={isActionPending}
      />
    </div>
  );
}
