import { describe, expect, it } from 'vitest';

import { redactSmsRecipientPhone } from '@/lib/sms/phone-redaction';

describe('redactSmsRecipientPhone', () => {
  it('keeps only the last four digits for SMS recipient phones', () => {
    expect(redactSmsRecipientPhone('+44 7700 900123')).toBe('+********0123');
    expect(redactSmsRecipientPhone('07700900123')).toBe('*******0123');
    expect(redactSmsRecipientPhone('1234')).toBe('****');
    expect(redactSmsRecipientPhone('   ')).toBe('Hidden');
  });
});
