import { ConnectCard } from '../components/ConnectCard';

type GbpConnectionSectionProps = {
  isConfigured: boolean;
  isConnecting: boolean;
  isPendingAuth: boolean;
  lastError: string | null;
  onConnect: () => void;
};

export function GbpConnectionSection({
  isConfigured,
  isConnecting,
  isPendingAuth,
  lastError,
  onConnect,
}: GbpConnectionSectionProps) {
  return (
    <div className="scroll-mt-24">
      <ConnectCard
        onConnect={onConnect}
        isConfigured={isConfigured}
        isConnecting={isConnecting}
        isPendingAuth={isPendingAuth}
        lastError={lastError}
      />
    </div>
  );
}
