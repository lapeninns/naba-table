import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "path";
import { Resend } from "resend";
import { fileURLToPath } from "url";

loadEnv({ path: resolvePath(process.cwd(), ".env.local") });
loadEnv({ path: resolvePath(process.cwd(), ".env.development") });
loadEnv({ path: resolvePath(process.cwd(), ".env") });

const DEFAULT_LIMIT = 5;
const MIN_FETCH_SIZE = 20;

export type ParsedArgs = {
  to: string;
  limit: number;
  json: boolean;
};

type DomainsList = Awaited<ReturnType<Resend["domains"]["list"]>>;
type EmailsList = Awaited<ReturnType<Resend["emails"]["list"]>>;
type EmailsListSuccess = NonNullable<EmailsList["data"]>;

type ResendClient = Pick<Resend, "domains" | "emails">;

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const options: ParsedArgs = {
    to: "",
    limit: DEFAULT_LIMIT,
    json: false,
  };

  while (args.length > 0) {
    const value = args.shift();
    if (!value) break;

    switch (value) {
      case "--to":
        options.to = args.shift() ?? "";
        break;
      case "--limit": {
        const rawLimit = Number(args.shift() ?? "");
        if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
          throw new Error("--limit must be a positive number");
        }
        options.limit = Math.min(Math.floor(rawLimit), 50);
        break;
      }
      case "--json":
        options.json = true;
        break;
      case "-h":
      case "--help":
        throw new Error("help");
      default:
        if (!options.to && !value.startsWith("--")) {
          options.to = value;
        }
        break;
    }
  }

  if (!options.to) {
    throw new Error("Recipient email is required. Pass with --to <email>");
  }

  return options;
}

function ensureSuccess<T extends { data: unknown; error: { message: string } | null }>(
  result: T | null | undefined,
): NonNullable<T["data"]> {
  if (!result || result.error || !result.data) {
    const message =
      (result && result.error && typeof result.error.message === "string"
        ? result.error.message
        : null) ?? "Unknown Resend API error";
    throw new Error(message);
  }
  return result.data as NonNullable<T["data"]>;
}

function extractDomain(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/@([^@>]+)>?$/);
  return match ? match[1].toLowerCase() : null;
}

function deriveSenderDomain(): string | null {
  return (
    extractDomain(process.env.RESEND_FROM) ??
    extractDomain(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) ??
    null
  );
}

function createClient(): ResendClient {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return iso;
  }
  return date.toISOString();
}

function formatMatches(matches: EmailsListSuccess["data"]): Array<{
  id: string;
  subject: string;
  last_event: string | null;
  created_at: string;
  from: string;
  reply_to: string[];
}> {
  return matches.map((item) => ({
    id: item.id,
    subject: item.subject,
    last_event: item.last_event ?? null,
    created_at: item.created_at,
    from: item.from,
    reply_to: item.reply_to ?? [],
  }));
}

function buildTextReport(params: {
  domainStatus: { senderDomain: string | null; statusLine: string };
  matches: ReturnType<typeof formatMatches>;
  totalMatches: number;
  searchAddress: string;
  requestedLimit: number;
}) {
  const lines: string[] = [];
  lines.push(`📬 Resend domain: ${params.domainStatus.statusLine}`);
  lines.push(`🔎 Search address: ${params.searchAddress}`);
  if (params.matches.length === 0) {
    lines.push("⚠️  No matching emails found in recent events.");
  } else {
    lines.push(`✅ Found ${params.matches.length} matching email${params.matches.length === 1 ? "" : "s"}:`);
    params.matches.forEach((match) => {
      lines.push(
        `  • ${formatEventDate(match.created_at)} — ${match.last_event ?? "unknown"} — ${match.subject}`,
      );
      lines.push(`    id: ${match.id}`);
      lines.push(`    from: ${match.from}`);
      if (match.reply_to.length > 0) {
        lines.push(`    reply-to: ${match.reply_to.join(", ")}`);
      }
    });
    if (params.totalMatches > params.requestedLimit) {
      lines.push(`(showing latest ${params.requestedLimit} of ${params.totalMatches} matches)`);
    }
  }
  lines.push("—");
  lines.push("Use --limit <n> to inspect more events or --json for raw output.");
  return lines.join("\n");
}

export async function runDiagnostics(
  options: ParsedArgs,
  client: ResendClient = createClient(),
): Promise<{
  domain: { senderDomain: string | null; statusLine: string };
  matches: ReturnType<typeof formatMatches>;
  totalMatches: number;
}> {
  const senderDomain = deriveSenderDomain();
  const domainsResponse = await client.domains.list();
  const domains = ensureSuccess(domainsResponse);
  const matchingDomain = senderDomain
    ? domains.data.find((domain) => domain.name.toLowerCase() === senderDomain)
    : undefined;

  let statusLine: string;
  if (matchingDomain) {
    const statusParts: string[] = [matchingDomain.status];
    const capability = (matchingDomain as { capability?: string | null }).capability;
    if (typeof capability === "string" && capability.trim().length > 0) {
      statusParts.push(capability);
    }
    statusLine = `${matchingDomain.name} (${statusParts.join(", ")})`;
  } else if (senderDomain) {
    statusLine = `${senderDomain} (not found in Resend domains list)`;
  } else {
    statusLine = "Unknown (RESEND_FROM not configured)";
  }

  const fetchLimit = Math.max(options.limit * 3, MIN_FETCH_SIZE);
  const emailsResponse = await client.emails.list({ limit: fetchLimit });
  const emails = ensureSuccess(emailsResponse);
  const searchLower = options.to.toLowerCase();
  const matches = emails.data.filter((item) =>
    item.to.some((recipient) => recipient.toLowerCase() === searchLower),
  );

  const limitedMatches = matches.slice(0, options.limit);

  return {
    domain: { senderDomain, statusLine },
    matches: formatMatches(limitedMatches),
    totalMatches: matches.length,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const diagnostics = await runDiagnostics(parsed);
    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            search: parsed.to,
            domain: diagnostics.domain,
            totalMatches: diagnostics.totalMatches,
            matches: diagnostics.matches,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        buildTextReport({
          domainStatus: diagnostics.domain,
          matches: diagnostics.matches,
          totalMatches: diagnostics.totalMatches,
          searchAddress: parsed.to,
          requestedLimit: parsed.limit,
        }),
      );
    }
    return 0;
  } catch (error) {
    if ((error as Error).message === "help") {
      console.log("Usage: pnpm email:check --to <email> [--limit N] [--json]");
      return 0;
    }
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  });
}
