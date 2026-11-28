import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  verifySameOrigin,
  writeAuditLog,
} from "@/lib/security";
import {
  dispatchTenantWebPush,
  persistNotificationPushOutcome,
  type PushMode,
} from "@/lib/web-push-dispatch";

const sendNotificationSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().trim().min(2, "عنوان الإشعار مطلوب").max(120),
  body: z.string().trim().min(2, "نص الإشعار مطلوب").max(400),
  daysValid: z.number().int().min(1).max(30).default(7),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const rl = await enforceRateLimit(
    buildRateLimitKey("push-send", user.id),
    25,
    600
  );
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز حد إرسال الإشعارات، يرجى الانتظار قليلاً" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = sendNotificationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات الإشعار غير صالحة" },
      { status: 400 }
    );
  }

  const { tenantId, title, body, daysValid, scheduledFor } = parsed.data;
  if (profile.role !== "super_admin" && profile.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "غير مصرح بإرسال إشعارات لجهة أخرى" },
      { status: 403 }
    );
  }

  const nowMs = Date.now();
  let scheduledIso: string | null = null;
  let isFutureScheduled = false;

  if (scheduledFor) {
    const scheduledMs = new Date(scheduledFor).getTime();
    if (!Number.isFinite(scheduledMs)) {
      return NextResponse.json(
        { error: "تاريخ الجدولة غير صالح" },
        { status: 400 }
      );
    }
    if (scheduledMs > nowMs + 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "لا يمكن جدولة الإشعار لأكثر من 30 يوماً مقدماً" },
        { status: 400 }
      );
    }
    if (scheduledMs > nowMs + 60 * 1000) {
      scheduledIso = new Date(scheduledMs).toISOString();
      isFutureScheduled = true;
    }
  }

  const baseMs = scheduledIso ? new Date(scheduledIso).getTime() : nowMs;
  const expiresAt = new Date(
    baseMs + daysValid * 24 * 60 * 60 * 1000
  ).toISOString();

  // Save In-App Notification using authenticated user context (respects RLS)
  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    title,
    body,
    expires_at: expiresAt,
  };
  if (scheduledIso) {
    insertPayload.scheduled_for = scheduledIso;
    insertPayload.push_sent = false;
    insertPayload.push_status = "pending";
  }

  const { data: notification, error: insertErr } = await supabase
    .from("notifications")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr || !notification) {
    return NextResponse.json(
      { error: insertErr?.message || "تعذر حفظ الإشعار" },
      { status: 400 }
    );
  }

  let pushResult: {
    pushMode: PushMode | "scheduled";
    pushTargeted: number;
    pushSent: number;
    pushFailed: number;
    pushCleaned: number;
    alreadySentCount?: number;
    lastError?: string | null;
  } = {
    pushMode: "no_subscribers",
    pushTargeted: 0,
    pushSent: 0,
    pushFailed: 0,
    pushCleaned: 0,
  };

  if (isFutureScheduled) {
    pushResult.pushMode = "scheduled";
  } else {
    try {
      const admin = createAdminSupabase();
      const { data: tenant } = await admin
        .from("tenants")
        .select("slug, name_ar")
        .eq("id", tenantId)
        .maybeSingle();

      const dispatch = await dispatchTenantWebPush({
        admin,
        tenantId,
        notificationId: notification.id,
        tenantSlug: tenant?.slug,
        tenantName: tenant?.name_ar,
        title,
        body,
      });

      pushResult = dispatch;
      await persistNotificationPushOutcome(
        admin,
        notification.id,
        dispatch,
        0
      );
    } catch {
      pushResult.pushMode = "dispatch_error";
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: profile.email,
    action: "send_tenant_notification",
    targetType: "notification",
    targetId: notification.id,
    details: {
      tenant_id: tenantId,
      scheduled_for: scheduledIso,
      ...pushResult,
    },
  });

  return NextResponse.json({
    ok: true,
    notification,
    ...pushResult,
  });
}
