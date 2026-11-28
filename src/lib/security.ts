import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

function getAllowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
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

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const raw = forwarded || realIp || "unknown";
  return raw.slice(0, 64);
}

export async function enforceRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc("check_api_rate_limit", {
      p_key: key.slice(0, 180),
      p_max_hits: maxHits,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("Rate limit RPC error:", error.message);
      return true;
    }
    return Boolean(data);
  } catch (err) {
    console.error("Rate limit check failed:", err);
    return true;
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
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
