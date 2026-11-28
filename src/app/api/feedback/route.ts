import { createHash, timingSafeEqual } from "node:crypto";
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
  orderId: z.string().uuid(),
  feedbackToken: z.string().trim().min(16).max(128),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(""),
});

function verifyFeedbackToken(providedToken: string, storedHashHex: string): boolean {
  const providedHashHex = createHash("sha256")
    .update(providedToken)
    .digest("hex");
  const a = Buffer.from(providedHashHex, "utf8");
  const b = Buffer.from(storedHashHex, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Saves post-order customer experience feedback ONLY for a cryptographically verified order.
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
      { error: "يرجى إرسال تقييم صالح مرتبط بطلب مؤكد" },
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

    // 1. Verify active tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("id", parsed.data.tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: "الجهة غير متاحة" }, { status: 404 });
    }

    // 2. Verify order exists, belongs to this tenant, and feedbackToken matches stored SHA-256 hash
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, tenant_id, feedback_token_hash")
      .eq("id", parsed.data.orderId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (orderErr || !order || !order.feedback_token_hash) {
      return NextResponse.json(
        { error: "تعذر التحقق من أهلية هذا الطلب للتقييم" },
        { status: 403 }
      );
    }

    if (
      !verifyFeedbackToken(parsed.data.feedbackToken, order.feedback_token_hash)
    ) {
      return NextResponse.json(
        { error: "رمز التحقق الخاص بتقييم الطلب غير صالح" },
        { status: 403 }
      );
    }

    // 3. Insert single verified feedback per order (unique constraint prevents duplicates)
    const { error: fbErr } = await admin.from("order_feedback").insert({
      tenant_id: tenant.id,
      order_id: order.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    });

    if (fbErr) {
      if (fbErr.code === "23505") {
        return NextResponse.json(
          { error: "تم استلام تقييمك لهذا الطلب مسبقاً" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "تعذر حفظ التقييم في قاعدة البيانات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "تعذر حفظ التقييم حالياً" },
      { status: 500 }
    );
  }
}
