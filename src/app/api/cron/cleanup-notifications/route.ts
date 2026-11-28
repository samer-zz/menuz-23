import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  dispatchTenantWebPush,
  persistNotificationPushOutcome,
} from "@/lib/web-push-dispatch";

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
 * Runs batched, non-blocking retention cleanup and dispatches due scheduled/retryable notifications.
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

    const scheduledPushSummary = {
      attempted: 0,
      sent: 0,
      partial: 0,
      failed: 0,
      vapid_not_configured: 0,
      no_subscribers: 0,
      errors: [] as string[],
    };

    // 1. Dispatch due scheduled notifications & retry partial/failed deliveries safely (max 5 attempts)
    try {
      const vapidConfigured = Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
          process.env.VAPID_PRIVATE_KEY?.trim()
      );
      const retryableStatuses = vapidConfigured
        ? ["pending", "partial", "failed", "vapid_not_configured"]
        : ["pending", "partial", "failed"];

      const { data: dueNotifs, error: dueErr } = await admin
        .from("notifications")
        .select("id, tenant_id, title, body, push_attempts, push_status")
        .eq("push_sent", false)
        .in("push_status", retryableStatuses)
        .lt("push_attempts", 5)
        .gt("expires_at", nowIso)
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(20);

      if (dueErr) {
        console.warn("[cron] Due notifications query failed:", dueErr.message);
        scheduledPushSummary.errors.push("due_notifications_query_failed");
      } else if (dueNotifs && dueNotifs.length > 0) {
        const tenantIds = Array.from(
          new Set(dueNotifs.map((n) => n.tenant_id))
        );
        const { data: tenants, error: tenantsErr } = await admin
          .from("tenants")
          .select("id, slug, name_ar")
          .in("id", tenantIds);

        if (tenantsErr) {
          console.warn("[cron] Tenants lookup failed:", tenantsErr.message);
          scheduledPushSummary.errors.push("tenants_lookup_failed");
        }

        const tenantMap = new Map(
          (tenants || []).map((t) => [t.id, t])
        );

        for (const notif of dueNotifs) {
          scheduledPushSummary.attempted += 1;
          try {
            const tenant = tenantMap.get(notif.tenant_id);
            const dispatch = await dispatchTenantWebPush({
              admin,
              tenantId: notif.tenant_id,
              notificationId: notif.id,
              tenantSlug: tenant?.slug,
              tenantName: tenant?.name_ar,
              title: notif.title,
              body: notif.body,
            });

            await persistNotificationPushOutcome(
              admin,
              notif.id,
              dispatch,
              Number(notif.push_attempts ?? 0)
            );

            if (dispatch.pushMode === "web_push_sent") {
              scheduledPushSummary.sent += 1;
            } else if (dispatch.pushMode === "web_push_partial") {
              scheduledPushSummary.partial += 1;
            } else if (
              dispatch.pushMode === "web_push_failed" ||
              dispatch.pushMode === "dispatch_error"
            ) {
              scheduledPushSummary.failed += 1;
            } else if (dispatch.pushMode === "vapid_not_configured") {
              scheduledPushSummary.vapid_not_configured += 1;
            } else {
              scheduledPushSummary.no_subscribers += 1;
            }
          } catch (err) {
            scheduledPushSummary.failed += 1;
            const msg =
              err instanceof Error ? err.message : "dispatch_exception";
            console.warn("[cron] Notification dispatch error:", msg);
            scheduledPushSummary.errors.push(`notif_${notif.id}_failed`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "scheduled_loop_error";
      console.warn("[cron] Scheduled push phase failed:", msg);
      scheduledPushSummary.errors.push("scheduled_phase_exception");
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
        scheduled_push: scheduledPushSummary,
        scheduled_dispatched: scheduledPushSummary.sent,
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
      scheduled_push: scheduledPushSummary,
      scheduled_dispatched: scheduledPushSummary.sent,
      timestamp: nowIso,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Maintenance cleanup failed" },
      { status: 500 }
    );
  }
}
