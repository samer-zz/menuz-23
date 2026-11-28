import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRateLimitIdentifier,
  verifySameOrigin,
} from "@/lib/security";
import {
  isAllowedPushEndpointUrl,
  resolveAndVerifyPublicPushEndpoint,
} from "@/lib/push-security";

const subscribeSchema = z.object({
  tenantId: z.string().uuid(),
  subscription: z.object({
    endpoint: z
      .string()
      .trim()
      .url()
      .max(600)
      .refine((u) => isAllowedPushEndpointUrl(u), {
        message: "رابط خدمة الإشعارات غير مدعوم أو غير آمن",
      }),
    keys: z.object({
      p256dh: z.string().min(10).max(300),
      auth: z.string().min(10).max(200),
    }),
  }),
});

const unsubscribeSchema = z.object({
  tenantId: z.string().uuid(),
  endpoint: z
    .string()
    .trim()
    .url()
    .max(600)
    .refine((u) => isAllowedPushEndpointUrl(u), {
      message: "رابط الاشتراك غير صالح",
    }),
});

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ident = getRateLimitIdentifier(request);
  const rl = await enforceRateLimit(
    buildRateLimitKey("push-sub", ident),
    20,
    600
  );
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message || "بيانات الاشتراك غير صالحة",
      },
      { status: 400 }
    );
  }

  const endpointSafe = await resolveAndVerifyPublicPushEndpoint(
    parsed.data.subscription.endpoint
  );
  if (!endpointSafe) {
    return NextResponse.json(
      { error: "نطاق خدمة الإشعارات غير مسموح أو يوجه لعنوان غير عام" },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminSupabase();
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, is_active")
      .eq("id", parsed.data.tenantId)
      .maybeSingle();

    if (!tenant || !tenant.is_active) {
      return NextResponse.json({ error: "الجهة غير متاحة" }, { status: 404 });
    }

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        tenant_id: tenant.id,
        endpoint: parsed.data.subscription.endpoint,
        p256dh: parsed.data.subscription.keys.p256dh,
        auth: parsed.data.subscription.keys.auth,
        user_agent: (request.headers.get("user-agent") || "").slice(0, 200),
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,endpoint" }
    );

    if (error) {
      return NextResponse.json(
        { error: "تعذر حفظ اشتراك الإشعارات في قاعدة البيانات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, stored: "database" });
  } catch {
    return NextResponse.json(
      { error: "تعذر حفظ اشتراك الإشعارات" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ident = getRateLimitIdentifier(request);
  const rl = await enforceRateLimit(
    buildRateLimitKey("push-unsub", ident),
    30,
    600
  );
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("tenant_id", parsed.data.tenantId)
      .eq("endpoint", parsed.data.endpoint);

    if (error) {
      return NextResponse.json(
        { error: "تعذر إلغاء اشتراك الإشعارات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "تعذر إلغاء اشتراك الإشعارات" },
      { status: 500 }
    );
  }
}
