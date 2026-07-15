type ValidationInput = {
  readonly content: string;
  readonly now: Date;
  readonly scripts: ReadonlySet<string>;
  readonly pathExists: (path: string) => boolean;
};

const REQUIRED_SECTIONS = [
  'Core commands',
  'Applications',
  'Non-negotiables',
  'Architecture and data flow',
] as const;

const PNPM_BUILT_INS = new Set(['add', 'exec', 'install', 'lint', 'remove', 'test']);
const MAX_REVIEW_AGE_DAYS = 180;

function readFrontmatterValue(content: string, key: string): string | null {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/u)?.[1];
  if (!frontmatter) {
    return null;
  }

  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'mu'));
  return match?.[1]?.trim() ?? null;
}

function validateFrontmatter(input: ValidationInput): string[] {
  const issues: string[] = [];

  for (const key of ['agents_version', 'last_reviewed', 'scope']) {
    if (!readFrontmatterValue(input.content, key)) {
      issues.push(`AGENTS.md frontmatter is missing ${key}.`);
    }
  }

  const reviewedAt = readFrontmatterValue(input.content, 'last_reviewed');
  const reviewedTime = reviewedAt ? Date.parse(reviewedAt) : Number.NaN;
  if (reviewedAt && !Number.isFinite(reviewedTime)) {
    issues.push('AGENTS.md last_reviewed must be an ISO date.');
  } else if (Number.isFinite(reviewedTime)) {
    const ageDays = (input.now.getTime() - reviewedTime) / (24 * 60 * 60 * 1000);
    if (ageDays > MAX_REVIEW_AGE_DAYS) {
      issues.push(`AGENTS.md last_reviewed is ${Math.floor(ageDays)} days old.`);
    }
  }

  return issues;
}

function validateSections(content: string): string[] {
  return REQUIRED_SECTIONS.filter(
    (section) => !new RegExp(`^##\\s+${section}\\s*$`, 'imu').test(content),
  ).map((section) => `AGENTS.md is missing the "${section}" section.`);
}

function validateCommands(input: ValidationInput): string[] {
  const issues: string[] = [];
  const commandPattern = /`pnpm(?: run)?\s+([a-zA-Z0-9:_-]+)(?:\s+[^`]*)?`/gu;

  for (const match of input.content.matchAll(commandPattern)) {
    const command = match[1];
    if (
      command &&
      !command.startsWith('-') &&
      !PNPM_BUILT_INS.has(command) &&
      !input.scripts.has(command)
    ) {
      issues.push(`AGENTS.md references unknown command "pnpm ${command}".`);
    }
  }

  return issues;
}

function validateLinks(input: ValidationInput): string[] {
  const issues: string[] = [];
  const linkPattern = /\]\((?!https?:\/\/|#)([^)#]+)(?:#[^)]+)?\)/gu;

  for (const match of input.content.matchAll(linkPattern)) {
    const path = match[1]?.trim();
    if (path && !input.pathExists(path)) {
      issues.push(`AGENTS.md references missing path "${path}".`);
    }
  }

  return issues;
}

export function validateAgentsDocument(input: ValidationInput): string[] {
  return [
    ...validateFrontmatter(input),
    ...validateSections(input.content),
    ...validateCommands(input),
    ...validateLinks(input),
  ];
}
