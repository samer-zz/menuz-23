import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type RateLimitStatus = "allowed" | "rate_limited" | "unavailable";

export interface RateLimitResult {
  status: RateLimitStatus;
  allowed: boolean;
}

const RATE_LIMIT_TIMEOUT_MS = 4000;

function getAllowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const directHost = request.headers.get("host")?.trim();
  if (forwardedHost) hosts.add(forwardedHost.toLowerCase());
  if (directHost) hosts.add(directHost.toLowerCase());

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      hosts.add(new URL(siteUrl).host.toLowerCase());
    } catch {
      // ignore invalid env
    }
  }
  return hosts;
}

export function verifySameOrigin(request: NextRequest): boolean {
  const allowedHosts = getAllowedHosts(request);
  if (allowedHosts.size === 0) return false;

  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") {
        return false;
      }
      return allowedHosts.has(parsedOrigin.host.toLowerCase());
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const parsedReferer = new URL(referer);
      if (parsedReferer.protocol !== "https:" && parsedReferer.protocol !== "http:") {
        return false;
      }
      return allowedHosts.has(parsedReferer.host.toLowerCase());
    } catch {
      return false;
    }
  }

  // Reject state-changing requests missing both Origin and Referer
  return false;
}

export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate || candidate.length > 64) return null;

  // Strip IPv6 brackets and optional port: [::1]:3000 -> ::1
  if (candidate.startsWith("[")) {
    const closeIdx = candidate.indexOf("]");
    if (closeIdx === -1) return null;
    candidate = candidate.slice(1, closeIdx);
  } else {
    // Strip IPv4 port if present: 1.2.3.4:1234 -> 1.2.3.4
    const colonCount = (candidate.match(/:/g) || []).length;
    if (colonCount === 1 && candidate.includes(".")) {
      candidate = candidate.split(":")[0];
    }
  }

  // Normalize IPv4-mapped IPv6 addresses: ::ffff:192.0.2.1 -> 192.0.2.1
  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const v4Part = candidate.slice(7);
    if (isIP(v4Part) === 4) {
      candidate = v4Part;
    }
  }

  const version = isIP(candidate);
  if (version === 0) return null;
  return candidate.toLowerCase();
}

/**
 * Extracts client IP preferring Vercel-injected trusted headers first,
 * then falling back to validated right-most proxy entry in x-forwarded-for.
 */
export function getClientIp(request: NextRequest): string {
  // 1. Vercel Edge trusted header (cannot be spoofed by client on Vercel)
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = normalizeIp(vercelForwarded.split(",")[0]);
    if (first) return first;
  }

  // 2. x-real-ip (injected by Vercel / reverse proxy)
  const realIp = normalizeIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  // 3. Fallback for non-Vercel/local proxy: check right-most valid IP in x-forwarded-for
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const normalized = normalizeIp(parts[i]);
      if (normalized) return normalized;
    }
  }

  return "unknown";
}

export function buildRateLimitKey(scope: string, identifier: string): string {
  const cleanScope = scope.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "rl";
  const digest = createHash("sha256")
    .update(`${cleanScope}:${identifier}`)
    .digest("hex")
    .slice(0, 32);
  return `${cleanScope}:${digest}`;
}

export async function enforceRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const admin = createAdminSupabase();
    const rpcPromise = admin.rpc("check_api_rate_limit", {
      p_key: key.slice(0, 128),
      p_max_hits: maxHits,
      p_window_seconds: windowSeconds,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Rate limit timeout")),
        RATE_LIMIT_TIMEOUT_MS
      );
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      console.warn("[security] Rate limit RPC error");
      return { status: "unavailable", allowed: false };
    }

    if (data === true) {
      return { status: "allowed", allowed: true };
    }

    return { status: "rate_limited", allowed: false };
  } catch {
    console.warn("[security] Rate limit verification unavailable");
    return { status: "unavailable", allowed: false };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function sanitizeSafeUrl(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeAuditLog(params: {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminSupabase();
    await admin.from("audit_logs").insert({
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
    });
  } catch {
    console.warn("[security] Failed to write audit log");
  }
}
