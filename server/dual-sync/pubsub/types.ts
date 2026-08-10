export type GooglePubsubIngressConfig = {
  readonly enabled: boolean;
  readonly expectedAudience: string;
  readonly pushServiceAccountEmail: string;
  readonly subscription: string;
};

export type GooglePubsubAuthenticationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'missing_token' | 'invalid_token' | 'claim_mismatch' | 'identity_mismatch';
    };

export type ParsedGoogleBusinessProfilePush =
  | {
      readonly kind: 'supported';
      readonly messageId: string;
      readonly eventHash: string;
      readonly eventType: 'GOOGLE_UPDATE';
      readonly externalAccountId: string;
      readonly externalLocationId: string;
      readonly publishedAt: string | null;
    }
  | {
      readonly kind: 'ignored';
      readonly messageId: string;
      readonly eventHash: string;
      readonly eventType: string | null;
      readonly reason: 'unsupported_event' | 'malformed_notification';
      readonly publishedAt: string | null;
    };

export type GooglePubsubPersistOutcome = {
  readonly outcome: 'accepted' | 'duplicate' | 'ignored' | 'unmatched';
};

export interface GooglePubsubPersistencePort {
  persist(input: {
    readonly subscription: string;
    readonly delivery: ParsedGoogleBusinessProfilePush;
  }): Promise<GooglePubsubPersistOutcome>;
}
