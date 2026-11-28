import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enforceRateLimit, getClientIp, verifySameOrigin } from "@/lib/security";

const metadataSchema = z
  .object({
    channel: z.enum(["whatsapp", "sms"]).optional(),
    total: z.number().finite().min(0).max(10_000_000).optional(),
    items_count: z.number().int().min(0).max(500).optional(),
    payment_method: z.enum(["cash", "wallet"]).optional(),
  })
  .strict()
  .optional();

const eventSchema = z.object({
  tenantId: z.string().uuid(),
  eventType: z.enum(["menu_scan", "item_view", "order_submit"]),
  itemId: z.string().uuid().optional().nullable(),
  metadata: metadataSchema,
});

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const allowed = await enforceRateLimit(`analytics:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح للطلبات" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const { error } = await admin.rpc("record_menu_event", {
      p_tenant_id: parsed.data.tenantId,
      p_event_type: parsed.data.eventType,
      p_item_id: parsed.data.itemId ?? null,
      p_metadata: parsed.data.metadata ?? {},
    });

    if (error) {
      return NextResponse.json({ error: "تعذر تسجيل الحدث" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
