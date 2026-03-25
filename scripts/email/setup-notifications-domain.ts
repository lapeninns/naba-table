import { Resolver } from "node:dns/promises";
import { execFileSync } from "node:child_process";

import { Resend, type DomainRecords } from "resend";

type DnsType = "TXT" | "CNAME" | "MX";
type DnsProvider = "vercel" | "cloudflare" | "unknown";

type DnsRecord = {
  name: string;
  type: DnsType;
  value: string;
  source: "resend" | "dmarc" | "bimi";
  priority?: number;
};

type CliCommand = {
  subdomain: string;
  type: DnsType;
  value: string;
  source: DnsRecord["source"];
};

const BASE_DOMAIN = "nabatable.com";
const SENDING_DOMAIN = "notifications.nabatable.com";
const SUBDOMAIN_LABEL = "notifications";
const BIMI_LOGO_FILENAME = "nabatable-bimi.svg";
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Refusing to continue without explicit configuration.",
    );
  }
  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function ensureHttpsUrl(rawUrl: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a valid absolute URL. Received: ${rawUrl}`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS. Received protocol: ${url.protocol}`);
  }

  return url;
}

function assertDomainRelationship(): void {
  if (!SENDING_DOMAIN.endsWith(`.${BASE_DOMAIN}`)) {
    throw new Error(
      `Configured sending domain ${SENDING_DOMAIN} is not a subdomain of ${BASE_DOMAIN}.`,
    );
  }
}

function normalizeFqdn(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function createResolver(servers?: string[]): Resolver {
  const resolver = new Resolver();
  if (servers?.length) {
    resolver.setServers(servers);
  }
  return resolver;
}

async function resolveAuthoritativeNameservers(domain: string): Promise<string[]> {
  try {
    const resolver = createResolver(PUBLIC_RESOLVERS);
    const records = await resolver.resolveNs(domain);
    return records.map((value) => normalizeFqdn(value)).sort();
  } catch {
    return [];
  }
}

function inferDnsProvider(nameservers: string[]): DnsProvider {
  if (nameservers.some((value) => value.includes("vercel-dns.com"))) return "vercel";
  if (nameservers.some((value) => value.includes("cloudflare.com"))) return "cloudflare";
  return "unknown";
}

function recordNameToFqdn(recordName: string): string {
  const normalized = recordName.trim();
  if (!normalized || normalized === "@") {
    return SENDING_DOMAIN;
  }

  if (normalized.endsWith(`.${BASE_DOMAIN}`)) {
    return normalized;
  }

  if (normalized.endsWith(`.${SUBDOMAIN_LABEL}`)) {
    return `${normalized}.${BASE_DOMAIN}`;
  }

  if (normalized.endsWith(`.${SENDING_DOMAIN}`)) {
    return normalized;
  }

  return `${normalized}.${SENDING_DOMAIN}`;
}

function dnsRecordTargetFqdn(record: DnsRecord): string {
  if (record.source === "dmarc" && record.name === "_dmarc") {
    return `_dmarc.${BASE_DOMAIN}`;
  }

  return recordNameToFqdn(record.name);
}

function fqdnToBaseSubdomain(fqdn: string): string {
  const suffix = `.${BASE_DOMAIN}`;
  if (!fqdn.endsWith(suffix)) {
    throw new Error(`FQDN ${fqdn} does not belong to base domain ${BASE_DOMAIN}.`);
  }
  return fqdn.slice(0, -suffix.length);
}

function resendRecordToDns(record: DomainRecords): DnsRecord | null {
  // Resend can include receiving records. We only need sending records here.
  if (record.record === "Receiving") {
    return null;
  }

  const fqdn = recordNameToFqdn(record.name);
  const subdomain = fqdnToBaseSubdomain(fqdn);

  return {
    name: subdomain,
    type: record.type,
    value: record.value,
    priority: record.priority,
    source: "resend",
  };
}

function buildRootDmarcRecord(ruaEmail: string): DnsRecord {
  return {
    name: "_dmarc",
    type: "TXT",
    source: "dmarc",
    value:
      `v=DMARC1; p=quarantine; sp=quarantine; pct=100; ` +
      `rua=mailto:${ruaEmail}; adkim=r; aspf=r; fo=1`,
  };
}

function buildSubdomainDmarcRecord(ruaEmail: string): DnsRecord {
  return {
    name: `_dmarc.${SUBDOMAIN_LABEL}`,
    type: "TXT",
    source: "dmarc",
    value:
      `v=DMARC1; p=quarantine; pct=100; ` +
      `rua=mailto:${ruaEmail}; adkim=r; aspf=r; fo=1`,
  };
}

function buildBimiRecord(assetBaseUrl: string, pemUrl: string | null): DnsRecord {
  const baseUrl = ensureHttpsUrl(assetBaseUrl, "BIMI asset base URL");
  if (!baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname = `${baseUrl.pathname}/`;
  }

  const logoUrl = new URL(BIMI_LOGO_FILENAME, baseUrl).toString();
  const authorityUrl = pemUrl ? ensureHttpsUrl(pemUrl, "BIMI PEM URL").toString() : "";

  return {
    name: `default._bimi.${SUBDOMAIN_LABEL}`,
    type: "TXT",
    source: "bimi",
    value: `v=BIMI1; l=${logoUrl}; a=${authorityUrl}`,
  };
}

function toVercelCliCommand(record: DnsRecord): CliCommand {
  if (record.type === "MX") {
    if (typeof record.priority !== "number") {
      throw new Error(`MX record ${record.name} is missing priority.`);
    }

    return {
      subdomain: record.name,
      type: record.type,
      source: record.source,
      value: `${record.priority} ${record.value}`,
    };
  }

  return {
    subdomain: record.name,
    type: record.type,
    source: record.source,
    value: record.value,
  };
}

function formatVercelDnsAdd(command: CliCommand): string {
  return `vercel dns add ${BASE_DOMAIN} ${command.subdomain} ${command.type} ${JSON.stringify(
    command.value,
  )}`;
}

function describeDnsTarget(record: DnsRecord): string {
  const value = record.type === "MX" && typeof record.priority === "number"
    ? `${record.priority} ${record.value}`
    : record.value;
  return `${record.source.toUpperCase()}\t${record.type}\t${dnsRecordTargetFqdn(record)}\t${value}`;
}

function shouldApplyDns(): boolean {
  return process.env.APPLY_DNS === "1";
}

function runVercelDnsAdd(command: CliCommand, token: string, scope: string | null): void {
  const args = ["dns", "add", BASE_DOMAIN, command.subdomain, command.type, command.value, "--token", token];
  if (scope) {
    args.push("--scope", scope);
  }

  execFileSync("vercel", args, { stdio: "inherit" });
}

async function getOrCreateDomain(resend: Resend): Promise<{ id: string; created: boolean }> {
  const listResponse = await resend.domains.list();
  if (listResponse.error) {
    throw new Error(`Failed to list Resend domains: ${listResponse.error.message}`);
  }

  const existing = listResponse.data?.data.find((domain) => domain.name === SENDING_DOMAIN);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const createResponse = await resend.domains.create({ name: SENDING_DOMAIN });
  if (createResponse.error || !createResponse.data) {
    const message = createResponse.error?.message ?? "Unknown error creating domain.";
    throw new Error(`Failed to create Resend domain: ${message}`);
  }

  return { id: createResponse.data.id, created: true };
}

async function main(): Promise<void> {
  assertDomainRelationship();

  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const ruaEmail = getOptionalEnv("DMARC_RUA_EMAIL") ?? `dmarc@${BASE_DOMAIN}`;
  const assetBaseUrl = getRequiredEnv("BIMI_ASSET_BASE_URL");
  const bimiPemUrl = getOptionalEnv("BIMI_PEM_URL");

  const resend = new Resend(resendApiKey);

  const { id: domainId, created } = await getOrCreateDomain(resend);
  console.log(
    `[resend] Domain ${SENDING_DOMAIN} ${created ? "created" : "found"} with id ${domainId}.`,
  );

  const domainResponse = await resend.domains.get(domainId);
  if (domainResponse.error || !domainResponse.data) {
    const message = domainResponse.error?.message ?? "Unknown error fetching domain details.";
    throw new Error(`Failed to fetch Resend domain details: ${message}`);
  }

  const resendRecords = domainResponse.data.records
    .map(resendRecordToDns)
    .filter((record): record is DnsRecord => record !== null);

  const dmarcRecords = [buildRootDmarcRecord(ruaEmail), buildSubdomainDmarcRecord(ruaEmail)];
  const bimiRecord = buildBimiRecord(assetBaseUrl, bimiPemUrl);

  const allRecords = [...resendRecords, ...dmarcRecords, bimiRecord];
  const cliCommands = allRecords.map(toVercelCliCommand);
  const authoritativeNameservers = await resolveAuthoritativeNameservers(BASE_DOMAIN);
  const dnsProvider = inferDnsProvider(authoritativeNameservers);

  console.log(
    `\n[dns] Authoritative nameservers for ${BASE_DOMAIN}: ${authoritativeNameservers.join(", ") || "(unresolved)"}`,
  );
  console.log(`[dns] Provider guess: ${dnsProvider}`);

  console.log("\n=== DNS records to publish on the authoritative DNS provider ===");
  for (const record of allRecords) {
    console.log(describeDnsTarget(record));
  }

  if (dnsProvider !== "vercel") {
    console.log(
      `\n[dns] ${BASE_DOMAIN} is not delegated to Vercel nameservers, so Vercel DNS changes will not affect live email authentication.`,
    );
    console.log(
      `[dns] Publish the records above in ${dnsProvider === "cloudflare" ? "Cloudflare DNS" : "your authoritative DNS provider"} instead.`,
    );

    if (shouldApplyDns()) {
      throw new Error(
        "APPLY_DNS=1 only supports Vercel-authoritative zones. Publish these records in the live authoritative DNS provider first.",
      );
    }

    return;
  }

  console.log("\n=== Vercel CLI commands (copy/paste safe) ===");
  for (const command of cliCommands) {
    console.log(formatVercelDnsAdd(command));
  }

  if (!shouldApplyDns()) {
    console.log(
      "\n[vercel] APPLY_DNS is not set to 1. Skipping DNS application and exiting safely.",
    );
    console.log(
      "[vercel] To apply automatically (non-interactive), set APPLY_DNS=1 and provide VERCEL_TOKEN (and optionally VERCEL_SCOPE).",
    );
    return;
  }

  const vercelToken = getRequiredEnv("VERCEL_TOKEN");
  const vercelScope = getOptionalEnv("VERCEL_SCOPE");

  console.log("\n[vercel] APPLY_DNS=1 detected. Applying DNS records via Vercel CLI...");
  for (const command of cliCommands) {
    console.log(`[vercel] Applying ${command.source} ${command.type} ${command.subdomain}`);
    runVercelDnsAdd(command, vercelToken, vercelScope);
  }

  console.log("\n[resend] Attempting domain verification...");
  const verifyResponse = await resend.domains.verify(domainId);
  if (verifyResponse.error) {
    console.log(
      `[resend] Verification call returned an error: ${verifyResponse.error.message}. DNS may still be propagating.`,
    );
    return;
  }

  console.log(`[resend] Verification requested for domain id ${domainId}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
