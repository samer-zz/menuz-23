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

const sendNotificationSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().trim().min(2, "عنوان الإشعار مطلوب").max(120),
  body: z.string().trim().min(2, "نص الإشعار مطلوب").max(400),
  daysValid: z.number().int().min(1).max(30).default(7),
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

  const { tenantId, title, body, daysValid } = parsed.data;
  if (profile.role !== "super_admin" && profile.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "غير مصرح بإرسال إشعارات لجهة أخرى" },
      { status: 403 }
    );
  }

  const expiresAt = new Date(
    Date.now() + daysValid * 24 * 60 * 60 * 1000
  ).toISOString();

  // Save In-App Notification using authenticated user context (respects RLS)
  const { data: notification, error: insertErr } = await supabase
    .from("notifications")
    .insert({
      tenant_id: tenantId,
      title,
      body,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertErr || !notification) {
    return NextResponse.json(
      { error: insertErr?.message || "تعذر حفظ الإشعار" },
      { status: 400 }
    );
  }

  let pushSent = 0;
  let pushCleaned = 0;
  let pushMode: "in_app_only" | "web_push_sent" | "vapid_not_configured" =
    "in_app_only";

  try {
    const admin = createAdminSupabase();
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug, name_ar")
      .eq("id", tenantId)
      .maybeSingle();

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(500);

    if (!subsErr && subs && subs.length > 0) {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

      if (!vapidPublic || !vapidPrivate) {
        pushMode = "vapid_not_configured";
      } else {
        // Optional open-source web-push delivery when installed & VAPID keys are configured
        const webPush = await import("web-push").catch(() => null);
        if (webPush?.default) {
          webPush.default.setVapidDetails(
            process.env.VAPID_SUBJECT || "mailto:admin@menuz.app",
            vapidPublic,
            vapidPrivate
          );
          const payload = JSON.stringify({
            title: `${tenant?.name_ar || "مينوز"} — ${title}`,
            body,
            icon: tenant?.slug
              ? `/api/manifest/${tenant.slug}/icon?size=192`
              : "/icons/icon-192.png",
            url: tenant?.slug ? `/m/${tenant.slug}` : "/",
          });

          const staleIds: string[] = [];
          await Promise.all(
            subs.map(async (sub) => {
              try {
                await webPush.default.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  payload
                );
                pushSent += 1;
              } catch (err: unknown) {
                const statusCode =
                  typeof err === "object" && err !== null && "statusCode" in err
                    ? Number((err as { statusCode: number }).statusCode)
                    : 0;
                if (statusCode === 404 || statusCode === 410) {
                  staleIds.push(sub.id);
                }
              }
            })
          );

          if (staleIds.length > 0) {
            await admin
              .from("push_subscriptions")
              .delete()
              .in("id", staleIds);
            pushCleaned = staleIds.length;
          }
          pushMode = "web_push_sent";
        }
      }
    }
  } catch {
    // Non-fatal: In-App realtime notification succeeded already
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: profile.email,
    action: "send_tenant_notification",
    targetType: "notification",
    targetId: notification.id,
    details: { tenant_id: tenantId, pushMode, pushSent, pushCleaned },
  });

  return NextResponse.json({
    ok: true,
    notification,
    pushMode,
    pushSent,
    pushCleaned,
  });
}
