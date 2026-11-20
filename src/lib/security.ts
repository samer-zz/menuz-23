import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true; // same-origin navigation or non-browser client
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
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
