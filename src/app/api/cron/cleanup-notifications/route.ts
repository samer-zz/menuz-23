import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";

function verifyBearerSecret(authHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!expectedSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = Buffer.from(authHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Scheduled maintenance Cron endpoint (kept at /api/cron/cleanup-notifications
 * to stay strictly within Vercel Hobby's 2-cron limit).
 * Runs batched, non-blocking retention cleanup without touching tenant catalogs or real customer orders.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!verifyBearerSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminSupabase();

    // Try migration 005 batched maintenance RPC first
    const { data: maintenanceResult, error: maintErr } = await admin.rpc(
      "run_maintenance_cleanup",
      { p_batch_size: 5000 }
    );

    if (!maintErr && maintenanceResult) {
      return NextResponse.json({
        ok: true,
        mode: "run_maintenance_cleanup",
        summary: maintenanceResult,
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback when migration 005 is not yet applied
    const { data: deletedNotifs, error: legacyErr } = await admin.rpc(
      "cleanup_expired_notifications"
    );

    if (legacyErr) {
      return NextResponse.json(
        { ok: false, error: legacyErr.message },
        { status: 500 }
      );
    }

    // Also trim expired rate_limits rows safely in batches
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    await admin
      .from("rate_limits")
      .delete()
      .lt("window_started_at", sevenDaysAgo);

    return NextResponse.json({
      ok: true,
      mode: "legacy_cleanup_fallback",
      deleted_notifications: deletedNotifs ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Maintenance cleanup failed" },
      { status: 500 }
    );
  }
}
