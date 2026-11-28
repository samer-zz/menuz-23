import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { dispatchTenantWebPush } from "@/lib/web-push-dispatch";

function verifyBearerSecret(
  authHeader: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!expectedSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = Buffer.from(authHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function isMissingFunctionError(err: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!err) return false;
  if (err.code === "42883" || err.code === "PGRST202") return true;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    (msg.includes("run_maintenance_cleanup") && msg.includes("does not exist"))
  );
}

/**
 * Scheduled maintenance Cron endpoint (kept at /api/cron/cleanup-notifications
 * to stay strictly within Vercel Hobby's 2-cron limit).
 * Runs batched, non-blocking retention cleanup and dispatches due scheduled notifications.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!verifyBearerSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminSupabase();
    const nowIso = new Date().toISOString();

    // 1. Dispatch any due scheduled notifications (scheduled_for <= now AND push_sent = false)
    let scheduledDispatched = 0;
    try {
      const { data: dueNotifs } = await admin
        .from("notifications")
        .select("id, tenant_id, title, body")
        .eq("push_sent", false)
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", nowIso)
        .gt("expires_at", nowIso)
        .order("scheduled_for", { ascending: true })
        .limit(20);

      if (dueNotifs && dueNotifs.length > 0) {
        const tenantIds = Array.from(
          new Set(dueNotifs.map((n) => n.tenant_id))
        );
        const { data: tenants } = await admin
          .from("tenants")
          .select("id, slug, name_ar")
          .in("id", tenantIds);
        const tenantMap = new Map(
          (tenants || []).map((t) => [t.id, t])
        );

        for (const notif of dueNotifs) {
          const tenant = tenantMap.get(notif.tenant_id);
          await dispatchTenantWebPush({
            admin,
            tenantId: notif.tenant_id,
            tenantSlug: tenant?.slug,
            tenantName: tenant?.name_ar,
            title: notif.title,
            body: notif.body,
          });
          await admin
            .from("notifications")
            .update({ push_sent: true })
            .eq("id", notif.id);
          scheduledDispatched += 1;
        }
      }
    } catch {
      // Non-fatal: continue maintenance cleanup even if push dispatch encounters an error
    }

    // 2. Execute migration 005 batched maintenance RPC with exact parameter p_batch_limit
    const { data: maintenanceResult, error: maintErr } = await admin.rpc(
      "run_maintenance_cleanup",
      { p_batch_limit: 5000 }
    );

    if (!maintErr) {
      return NextResponse.json({
        ok: true,
        mode: "run_maintenance_cleanup",
        summary: maintenanceResult,
        scheduled_dispatched: scheduledDispatched,
        timestamp: nowIso,
      });
    }

    // Only fall back when run_maintenance_cleanup is genuinely absent (pre-005);
    // never swallow permission, connection, or SQL execution errors.
    if (!isMissingFunctionError(maintErr)) {
      return NextResponse.json(
        { ok: false, error: maintErr.message || "Maintenance RPC failed" },
        { status: 500 }
      );
    }

    const { data: deletedNotifs, error: legacyErr } = await admin.rpc(
      "cleanup_expired_notifications"
    );

    if (legacyErr) {
      return NextResponse.json(
        { ok: false, error: legacyErr.message },
        { status: 500 }
      );
    }

    // Trim expired api_rate_limits rows safely using actual schema column window_start
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { error: rlErr } = await admin
      .from("api_rate_limits")
      .delete()
      .lt("window_start", sevenDaysAgo);

    if (rlErr) {
      return NextResponse.json(
        { ok: false, error: rlErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "legacy_cleanup_fallback",
      deleted_notifications: deletedNotifs ?? 0,
      scheduled_dispatched: scheduledDispatched,
      timestamp: nowIso,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Maintenance cleanup failed" },
      { status: 500 }
    );
  }
}
