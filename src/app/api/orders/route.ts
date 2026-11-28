import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRateLimitIdentifier,
  verifySameOrigin,
} from "@/lib/security";
import { formatInvoiceMessage } from "@/lib/utils";

const orderSchema = z.object({
  tenantId: z.string().uuid(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, "السلة فارغة")
    .max(100),
  customerName: z.string().trim().max(100).optional().default(""),
  customerPhone: z
    .string()
    .trim()
    .max(25)
    .optional()
    .default("")
    .refine((v) => !v || /^[+0-9\s()-]{6,25}$/.test(v), {
      message: "صيغة رقم الجوال غير صالحة",
    }),
  orderType: z.enum(["delivery", "pickup"]),
  deliveryAddress: z.string().trim().max(300).optional().default(""),
  paymentMethod: z.enum(["cash", "wallet"]),
  walletId: z.string().uuid().optional().nullable(),
  transactionRef: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(400).optional().default(""),
  channel: z.enum(["whatsapp", "sms", "direct"]).default("whatsapp"),
});

function computeOrderPayloadHash(params: {
  tenantId: string;
  itemsSnapshot: Array<{ item_id: string; quantity: number; unit_price: number }>;
  orderType: string;
  deliveryAddress: string;
  paymentMethod: string;
  walletId: string | null;
  transactionRef: string;
  notes: string;
  channel: string;
  customerName: string;
  customerPhone: string;
}): string {
  const canonical = JSON.stringify({
    tenantId: params.tenantId,
    items: [...params.itemsSnapshot]
      .sort((a, b) => a.item_id.localeCompare(b.item_id))
      .map((i) => [i.item_id, i.quantity, i.unit_price]),
    orderType: params.orderType,
    deliveryAddress: params.deliveryAddress,
    paymentMethod: params.paymentMethod,
    walletId: params.walletId,
    transactionRef: params.transactionRef,
    notes: params.notes,
    channel: params.channel,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "يرجى مراجعة بيانات الطلب" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.orderType === "delivery" && !data.deliveryAddress.trim()) {
    return NextResponse.json(
      { error: "يرجى إدخال عنوان التوصيل" },
      { status: 400 }
    );
  }
  if (data.paymentMethod === "wallet" && !data.transactionRef.trim()) {
    return NextResponse.json(
      { error: "يرجى إدخال رقم عملية التحويل للمحفظة" },
      { status: 400 }
    );
  }

  const ident = getRateLimitIdentifier(request);
  const rl = await enforceRateLimit(buildRateLimitKey("orders", ident), 25, 600);
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم إرسال طلبات كثيرة مؤقتاً، يرجى الانتظار قليلاً" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً، يرجى المحاولة بعد قليل" },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminSupabase();

    // 1. Verify active tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("id, name_ar, currency, is_active, has_delivery")
      .eq("id", data.tenantId)
      .maybeSingle();

    if (tenantErr || !tenant || !tenant.is_active) {
      return NextResponse.json(
        { error: "هذا المنيو غير متاح لاستقبال الطلبات حالياً" },
        { status: 404 }
      );
    }

    if (data.orderType === "delivery" && !tenant.has_delivery) {
      return NextResponse.json(
        { error: "خدمة التوصيل غير مفعّلة لهذه الجهة" },
        { status: 400 }
      );
    }

    // 2. Fetch authoritative prices & availability from DB (never trust client price)
    const requestedIds = Array.from(new Set(data.items.map((i) => i.itemId)));
    const { data: dbItems, error: itemsErr } = await admin
      .from("menu_items")
      .select("id, name, price, is_available, badges")
      .eq("tenant_id", tenant.id)
      .in("id", requestedIds);

    if (itemsErr || !dbItems) {
      return NextResponse.json(
        { error: "تعذر التحقق من الأصناف المطلوبة" },
        { status: 500 }
      );
    }

    const itemMap = new Map(dbItems.map((it) => [it.id, it]));
    const itemsSnapshot: Array<{
      item_id: string;
      name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }> = [];

    // Collapse duplicate itemIds safely if client passed any
    const qtyByItem = new Map<string, number>();
    for (const line of data.items) {
      qtyByItem.set(line.itemId, (qtyByItem.get(line.itemId) || 0) + line.quantity);
    }

    let computedTotal = 0;
    for (const [itemId, qty] of qtyByItem.entries()) {
      const dbItem = itemMap.get(itemId);
      if (!dbItem) {
        return NextResponse.json(
          { error: "أحد الأصناف غير موجود في قائمة هذه الجهة" },
          { status: 400 }
        );
      }
      const badges = Array.isArray(dbItem.badges) ? dbItem.badges : [];
      if (!dbItem.is_available || badges.includes("unavailable")) {
        return NextResponse.json(
          { error: `الصنف «${dbItem.name}» غير متوفر حالياً` },
          { status: 400 }
        );
      }
      const unitPrice = Number(dbItem.price);
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      computedTotal = Math.round((computedTotal + lineTotal) * 100) / 100;
      itemsSnapshot.push({
        item_id: dbItem.id,
        name: dbItem.name,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
    }

    // 3. Resolve and verify optional wallet belongs to THIS tenant and is active
    let walletName: string | undefined;
    let walletAccount: string | undefined;
    if (data.paymentMethod === "wallet" && data.walletId) {
      const { data: wallet, error: walletErr } = await admin
        .from("wallets")
        .select("name, account_number, is_active")
        .eq("id", data.walletId)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (walletErr || !wallet || !wallet.is_active) {
        return NextResponse.json(
          { error: "المحفظة المحددة غير صالحة أو غير مفعّلة لهذه الجهة" },
          { status: 400 }
        );
      }
      walletName = wallet.name;
      walletAccount = wallet.account_number;
    }

    const orderNumber = `MZ-${Date.now().toString(36).toUpperCase().slice(-5)}-${data.idempotencyKey
      .slice(0, 4)
      .toUpperCase()}`;

    const payloadHash = computeOrderPayloadHash({
      tenantId: tenant.id,
      itemsSnapshot,
      orderType: data.orderType,
      deliveryAddress:
        data.orderType === "delivery" ? data.deliveryAddress : "",
      paymentMethod: data.paymentMethod,
      walletId: data.paymentMethod === "wallet" ? data.walletId ?? null : null,
      transactionRef:
        data.paymentMethod === "wallet" ? data.transactionRef : "",
      notes: data.notes,
      channel: data.channel,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
    });

    const feedbackToken = randomBytes(24).toString("base64url");
    const feedbackTokenHash = createHash("sha256")
      .update(feedbackToken)
      .digest("hex");

    const itemsCount = itemsSnapshot.reduce((a, b) => a + b.quantity, 0);

    // 4. Atomic DB insert + idempotency conflict check + analytics event
    const { data: atomicResult, error: atomicErr } = await admin.rpc(
      "create_order_atomic",
      {
        p_tenant_id: tenant.id,
        p_tenant_name_snapshot: tenant.name_ar,
        p_order_number: orderNumber,
        p_idempotency_key: data.idempotencyKey,
        p_payload_hash: payloadHash,
        p_feedback_token_hash: feedbackTokenHash,
        p_customer_name: data.customerName || "",
        p_customer_phone: data.customerPhone || "",
        p_order_type: data.orderType,
        p_delivery_address:
          data.orderType === "delivery" ? data.deliveryAddress : "",
        p_payment_method: data.paymentMethod,
        p_wallet_name: walletName || "",
        p_transaction_ref:
          data.paymentMethod === "wallet" ? data.transactionRef : "",
        p_notes: data.notes || "",
        p_items_snapshot: itemsSnapshot,
        p_computed_total: computedTotal,
        p_currency: tenant.currency || "ر.ي",
        p_channel: data.channel,
        p_items_count: itemsCount,
      }
    );

    if (atomicErr || !atomicResult) {
      return NextResponse.json(
        { error: "تعذر توثيق الطلب في قاعدة البيانات، يرجى المحاولة مجدداً" },
        { status: 500 }
      );
    }

    const resObj = atomicResult as {
      outcome: "created" | "duplicate" | "conflict";
      order_id: string;
      order_number: string;
      computed_total?: number;
      currency?: string;
      items_snapshot?: typeof itemsSnapshot;
    };

    if (resObj.outcome === "conflict") {
      return NextResponse.json(
        {
          error:
            "مفتاح الطلب مستخدم مسبقاً ببيانات مختلفة؛ يرجى إعادة إرسال الطلب",
        },
        { status: 409 }
      );
    }

    const isDuplicate = resObj.outcome === "duplicate";
    const finalTotal = Number(resObj.computed_total ?? computedTotal);
    const finalCurrency = resObj.currency || tenant.currency || "ر.ي";
    const finalItems = resObj.items_snapshot || itemsSnapshot;

    const invoiceMessage = formatInvoiceMessage({
      tenantName: tenant.name_ar,
      currency: finalCurrency,
      items: finalItems.map((s) => ({
        name: s.name,
        quantity: s.quantity,
        price: s.unit_price,
      })),
      total: finalTotal,
      customerName: data.customerName || "ضيف الكريم",
      customerPhone: data.customerPhone || "غير مضاف",
      orderType: data.orderType,
      deliveryAddress: data.deliveryAddress || undefined,
      paymentMethod: data.paymentMethod,
      walletName,
      walletAccount,
      transactionRef: data.transactionRef || undefined,
      notes: data.notes || undefined,
    });

    return NextResponse.json({
      ok: true,
      orderId: resObj.order_id,
      orderNumber: resObj.order_number,
      computedTotal: finalTotal,
      currency: finalCurrency,
      itemsSnapshot: finalItems,
      invoiceMessage,
      duplicate: isDuplicate,
      feedbackToken: isDuplicate ? undefined : feedbackToken,
    });
  } catch {
    return NextResponse.json(
      { error: "تعذر إتمام الطلب حالياً، يرجى المحاولة مرة أخرى" },
      { status: 500 }
    );
  }
}
