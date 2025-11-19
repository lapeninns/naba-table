'use client';

type InviteInvalidReason = 'not_found' | 'revoked' | 'expired' | 'accepted';

type InviteInvalidProps = {
  reason: InviteInvalidReason;
};

const MESSAGE_MAP: Record<InviteInvalidReason, { title: string; description: string }> = {
  not_found: {
    title: 'Invitation not found',
    description: 'The invite link may be incorrect or has already been used. Contact your restaurant admin for a new invite.',
  },
  revoked: {
    title: 'Invitation revoked',
    description: 'This invitation was revoked by the restaurant team. Reach out to them if you believe this is a mistake.',
  },
  expired: {
    title: 'Invitation expired',
    description: 'This invitation has expired. Ask your restaurant admin to send you a new invite.',
  },
  accepted: {
    title: 'Invitation already accepted',
    description: 'You have already joined this restaurant team. Sign in to continue or contact support if you need help.',
  },
};

export function InviteInvalidState({ reason }: InviteInvalidProps) {
  const message = MESSAGE_MAP[reason];

  const containerClassName = 'space-y-4';
  const textAlignment = 'text-left';

  return (
    <div className={containerClassName}>
      <div className="max-w-md space-y-3">
        <h1 className={`text-3xl font-semibold text-slate-900 ${textAlignment}`}>{message.title}</h1>
        <p className={`text-sm text-slate-600 ${textAlignment}`}>{message.description}</p>
      </div>
    </div>
  );
}
