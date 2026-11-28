import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRateLimitIdentifier,
  verifySameOrigin,
} from "@/lib/security";

const subscribeSchema = z.object({
  tenantId: z.string().uuid(),
  subscription: z.object({
    endpoint: z
      .string()
      .url()
      .max(600)
      .refine((u) => u.startsWith("https://"), {
        message: "رابط الاشتراك غير آمن",
      }),
    keys: z.object({
      p256dh: z.string().min(10).max(300),
      auth: z.string().min(10).max(200),
    }),
  }),
});

const unsubscribeSchema = z.object({
  tenantId: z.string().uuid(),
  endpoint: z.string().url().max(600),
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
      { error: "بيانات الاشتراك غير صالحة" },
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
      // Graceful fallback if migration 005 is not yet applied
      return NextResponse.json({
        ok: true,
        stored: "in_app_only",
        note: "بانتظار تفعيل جدول push_subscriptions من قاعدة البيانات",
      });
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

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("tenant_id", parsed.data.tenantId)
      .eq("endpoint", parsed.data.endpoint);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
