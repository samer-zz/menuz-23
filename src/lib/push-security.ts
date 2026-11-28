import dns from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_PUSH_EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "wns.notify.windows.com",
]);

const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
  ".webpush.microsoft.com",
  ".push.services.mozilla.com",
];

export type EndpointVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_url" | "private_ip" | "dns_transient_error";
      permanent: boolean;
    };

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((x) => Number(x));
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  const ver = isIP(ip);
  if (ver === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  if (ver === 6) {
    if (ip === "::" || ip === "::1") return true;
    if (ip.startsWith("::ffff:")) {
      return isPrivateOrReservedIpv4(ip.slice(7));
    }
    // Unique local fc00::/7, link-local fe80::/10, multicast ff00::/8
    if (
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe8") ||
      ip.startsWith("fe9") ||
      ip.startsWith("fea") ||
      ip.startsWith("feb") ||
      ip.startsWith("ff")
    ) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Validates that a Web Push subscription endpoint is strictly HTTPS on default port,
 * is not an IP literal or internal hostname, and matches recognized browser Push Services.
 */
export function isAllowedPushEndpointUrl(
  rawUrl: string | null | undefined
): boolean {
  if (!rawUrl || rawUrl.length > 600) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "443") return false;

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 253) return false;
  if (isIP(hostname) !== 0) return false;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".arpa")
  ) {
    return false;
  }

  if (ALLOWED_PUSH_EXACT_HOSTS.has(hostname)) return true;
  return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Verifies URL allowlist PLUS DNS resolution to public IPs while distinguishing
 * permanent SSRF/invalid URLs from transient DNS resolution failures (SERVFAIL/EAI_AGAIN/Timeout)
 * so healthy push subscriptions are never deleted during transient DNS outages.
 */
export async function verifyPublicPushEndpoint(
  rawUrl: string,
  lookupFn: (hostname: string) => Promise<Array<{ address: string }>> = (host) =>
    dns.lookup(host, { all: true })
): Promise<EndpointVerificationResult> {
  if (!isAllowedPushEndpointUrl(rawUrl)) {
    return { ok: false, reason: "invalid_url", permanent: true };
  }

  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    const records = await lookupFn(hostname);
    if (!records || records.length === 0) {
      return { ok: false, reason: "dns_transient_error", permanent: false };
    }
    const hasPrivateIp = records.some((rec) =>
      isPrivateOrReservedIp(rec.address)
    );
    if (hasPrivateIp) {
      return { ok: false, reason: "private_ip", permanent: true };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "dns_transient_error", permanent: false };
  }
}

export async function resolveAndVerifyPublicPushEndpoint(
  rawUrl: string,
  lookupFn?: (hostname: string) => Promise<Array<{ address: string }>>
): Promise<boolean> {
  const res = await verifyPublicPushEndpoint(rawUrl, lookupFn);
  return res.ok;
}
