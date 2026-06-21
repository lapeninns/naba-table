export function redactSmsRecipientPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return 'Hidden';
  if (digits.length <= 4) return `${trimmed.startsWith('+') ? '+' : ''}****`;

  const visibleSuffix = digits.slice(-4);
  const maskLength = Math.max(4, Math.min(8, digits.length - visibleSuffix.length));
  return `${trimmed.startsWith('+') ? '+' : ''}${'*'.repeat(maskLength)}${visibleSuffix}`;
}
