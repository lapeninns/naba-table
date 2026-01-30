export function isRolloutEnabled(params: {
  percent: number;
  subject: string;
  salt: string;
}): boolean {
  const percent = Math.floor(params.percent);
  if (percent <= 0) return false;
  if (percent >= 100) return true;

  const subject = params.subject.trim();
  if (subject.length === 0) return false;

  // Deterministic 0..99 bucket via FNV-1a hash.
  const input = `${params.salt}:${subject}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Normalize into [0, 99].
  const bucket = (hash >>> 0) % 100;
  return bucket < percent;
}
