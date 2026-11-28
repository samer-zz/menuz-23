import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRateLimitIdentifier,
  verifySameOrigin,
} from "@/lib/security";

const feedbackSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(""),
});

/**
 * Saves optional post-order customer experience feedback.
 * Strictly visible ONLY to Super Admin (enforced at DB/RLS & API layers, never exposed to Tenant Admin).
 */
export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "يرجى اختيار تقييم من 1 إلى 5" },
      { status: 400 }
    );
  }

  const ident = getRateLimitIdentifier(request);
  const rl = await enforceRateLimit(
    buildRateLimitKey("feedback", ident),
    15,
    600
  );
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح لإرسال التقييمات" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminSupabase();
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, slug, name_ar")
      .eq("id", parsed.data.tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: "الجهة غير متاحة" }, { status: 404 });
    }

    // Try migration 005 table first
    const { error: fbErr } = await admin.from("order_feedback").insert({
      tenant_id: tenant.id,
      order_id: parsed.data.orderId ?? null,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    });

    if (fbErr) {
      // Graceful fallback before migration 005: store in super-admin-only audit_logs
      // (client_admin has zero SELECT access on audit_logs).
      await admin.from("audit_logs").insert({
        actor_id: null,
        actor_email: "customer-feedback",
        action: "order_experience_feedback",
        target_type: "tenant",
        target_id: tenant.id,
        details: {
          tenant_name: tenant.name_ar,
          tenant_slug: tenant.slug,
          order_id: parsed.data.orderId ?? null,
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "تعذر حفظ التقييم حالياً" },
      { status: 500 }
    );
  }
}
