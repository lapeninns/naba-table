import { lookup } from "node:dns/promises";
import { Resolver } from "node:dns/promises";
import process from "node:process";

import { Resend, type DomainRecords } from "resend";

type DnsType = "TXT" | "CNAME" | "MX";
type DnsProvider = "vercel" | "cloudflare" | "unknown";

type DnsRecord = {
  name: string;
  fqdn: string;
  type: DnsType;
  value: string;
  source: "resend" | "dmarc" | "bimi";
  priority?: number;
};

const BASE_DOMAIN = "nabatable.com";
const SENDING_DOMAIN = "notifications.nabatable.com";
const SUBDOMAIN_LABEL = "notifications";
const BIMI_ASSET_URL = "https://assets.nabatable.com/bimi/nabatable-bimi.svg";
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];
const VERCEL_NAMESERVERS = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeFqdn(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

function normalizeTxtValue(value: string): string {
  return value.trim().replace(/^"+|"+$/g, "");
}

function normalizeMxValue(priority: number, exchange: string): string {
  return `${priority} ${normalizeFqdn(exchange)}`;
}

function inferDnsProvider(nameservers: string[]): DnsProvider {
  const normalized = nameservers.map((value) => normalizeFqdn(value));
  if (normalized.some((value) => value.includes("vercel-dns.com"))) return "vercel";
  if (normalized.some((value) => value.includes("cloudflare.com"))) return "cloudflare";
  return "unknown";
}

function createResolver(servers?: string[]): Resolver {
  const resolver = new Resolver();
  if (servers?.length) {
    resolver.setServers(servers);
  }
  return resolver;
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

function resendRecordToDns(record: DomainRecords): DnsRecord | null {
  if (record.record === "Receiving") {
    return null;
  }

  return {
    name: record.name,
    fqdn: recordNameToFqdn(record.name),
    type: record.type,
    value: record.value,
    priority: record.priority,
    source: "resend",
  };
}

function buildExtraRecords(): DnsRecord[] {
  return [
    {
      name: `_dmarc.${SUBDOMAIN_LABEL}`,
      fqdn: `_dmarc.${SENDING_DOMAIN}`,
      type: "TXT",
      value: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@${BASE_DOMAIN}; adkim=r; aspf=r; fo=1`,
      source: "dmarc",
    },
    {
      name: `default._bimi.${SUBDOMAIN_LABEL}`,
      fqdn: `default._bimi.${SENDING_DOMAIN}`,
      type: "TXT",
      value: `v=BIMI1; l=${BIMI_ASSET_URL}; a=`,
      source: "bimi",
    },
  ];
}

async function resolveNameservers(domain: string): Promise<string[]> {
  const resolver = createResolver(PUBLIC_RESOLVERS);
  try {
    const records = await resolver.resolveNs(domain);
    return records.map((value) => normalizeFqdn(value)).sort();
  } catch {
    return [];
  }
}

async function queryDns(record: DnsRecord, servers: string[]): Promise<string[]> {
  const resolver = createResolver(servers);

  try {
    switch (record.type) {
      case "TXT": {
        const records = await resolver.resolveTxt(record.fqdn);
        return records.map((entry) => normalizeTxtValue(entry.join(""))).sort();
      }
      case "CNAME": {
        const records = await resolver.resolveCname(record.fqdn);
        return records.map((entry) => normalizeFqdn(entry)).sort();
      }
      case "MX": {
        const records = await resolver.resolveMx(record.fqdn);
        return records
          .map((entry) => normalizeMxValue(entry.priority, entry.exchange))
          .sort();
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

async function resolveNameServerIps(hostnames: string[]): Promise<string[]> {
  const resolved = await Promise.all(
    hostnames.map(async (hostname) => {
      try {
        const result = await lookup(hostname);
        return result.address;
      } catch {
        return null;
      }
    }),
  );

  return resolved.filter((value): value is string => Boolean(value));
}

function expectedRecordValue(record: DnsRecord): string {
  if (record.type === "MX") {
    return normalizeMxValue(record.priority ?? 0, record.value);
  }

  if (record.type === "TXT") {
    return normalizeTxtValue(record.value);
  }

  return normalizeFqdn(record.value);
}

function recordMatches(record: DnsRecord, actualValues: string[]): boolean {
  const expected = expectedRecordValue(record);
  return actualValues.includes(expected);
}

function formatSenderWarning(resendFrom: string | null): string | null {
  if (!resendFrom) {
    return "RESEND_FROM is not set in the current environment.";
  }

  const normalized = resendFrom.trim().toLowerCase();
  const [, domain] = normalized.split("@");

  if (!domain) {
    return `RESEND_FROM is not a valid email address: ${resendFrom}`;
  }

  if (domain !== SENDING_DOMAIN) {
    return `RESEND_FROM points at ${domain}, but the verified sending domain is ${SENDING_DOMAIN}.`;
  }

  return null;
}

async function main(): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const resendFrom = process.env.RESEND_FROM?.trim() ?? null;
  const resend = new Resend(resendApiKey);
  const vercelResolverIps = await resolveNameServerIps(VERCEL_NAMESERVERS);

  const listResponse = await resend.domains.list();
  if (listResponse.error) {
    throw new Error(`Failed to list Resend domains: ${listResponse.error.message}`);
  }

  const resendDomain = listResponse.data?.data.find((domain) => domain.name === SENDING_DOMAIN);
  if (!resendDomain) {
    throw new Error(`Resend domain ${SENDING_DOMAIN} was not found.`);
  }

  const domainResponse = await resend.domains.get(resendDomain.id);
  if (domainResponse.error || !domainResponse.data) {
    const message = domainResponse.error?.message ?? "Unknown error fetching domain details.";
    throw new Error(`Failed to fetch Resend domain details: ${message}`);
  }

  const nameservers = await resolveNameservers(BASE_DOMAIN);
  const dnsProvider = inferDnsProvider(nameservers);
  const senderWarning = formatSenderWarning(resendFrom);

  const expectedRecords = [
    ...domainResponse.data.records.map(resendRecordToDns).filter((record): record is DnsRecord => record !== null),
    ...buildExtraRecords(),
  ];

  let failures = 0;

  console.log(`Resend domain: ${SENDING_DOMAIN}`);
  console.log(`Resend status: ${domainResponse.data.status}`);
  console.log(`Authoritative DNS: ${nameservers.join(", ") || "(unresolved)"}`);
  console.log(`Provider guess: ${dnsProvider}`);
  console.log(`RESEND_FROM: ${resendFrom ?? "(unset)"}`);

  if (senderWarning) {
    failures += 1;
    console.log(`WARN sender: ${senderWarning}`);
  }

  console.log("\nRecord audit:");

  for (const record of expectedRecords) {
    const publicValues = await queryDns(record, PUBLIC_RESOLVERS);
    const vercelValues = vercelResolverIps.length > 0 ? await queryDns(record, vercelResolverIps) : [];
    const publicMatch = recordMatches(record, publicValues);
    const vercelMatch = recordMatches(record, vercelValues);

    const scopeLabel = record.priority ? `${record.type} ${record.priority}` : record.type;
    console.log(`- ${scopeLabel} ${record.fqdn}`);
    console.log(`  expected: ${expectedRecordValue(record)}`);
    console.log(`  public: ${publicValues.join(" | ") || "(missing)"}`);
    console.log(`  vercel-ns: ${vercelValues.join(" | ") || "(missing)"}`);

    if (!publicMatch) {
      failures += 1;
      console.log("  status: FAIL public DNS does not match the expected record.");
      if (dnsProvider !== "vercel" && vercelMatch) {
        console.log("  hint: record exists on Vercel nameservers, but Vercel is not authoritative for the live domain.");
      }
    } else {
      console.log("  status: OK public DNS matches.");
    }
  }

  if (domainResponse.data.status !== "verified") {
    failures += 1;
    console.log(`\nFAIL resend domain status is ${domainResponse.data.status}, not verified.`);
  }

  if (failures > 0) {
    console.log(`\nDeliverability audit failed with ${failures} issue(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nDeliverability audit passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
