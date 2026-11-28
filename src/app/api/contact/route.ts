import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getClientIp,
  verifySameOrigin,
} from "@/lib/security";

const contactSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(120, "الاسم طويل جداً"),
  phone: z
    .string()
    .trim()
    .min(7, "رقم الهاتف مطلوب")
    .max(25, "رقم الهاتف طويل جداً")
    .regex(/^[+0-9\s()-]{7,25}$/, "صيغة رقم الهاتف غير صالحة"),
  business_name: z
    .string()
    .trim()
    .max(120, "اسم النشاط طويل جداً")
    .optional()
    .default(""),
  message: z
    .string()
    .trim()
    .min(5, "الرسالة مطلوبة")
    .max(1500, "الرسالة تتجاوز الحد الأقصى المسموح"),
  website: z.string().max(120).optional().default(""),
});

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

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "يرجى التأكد من البيانات" },
      { status: 400 }
    );
  }

  // Honeypot anti-spam trap: silently accept bot submissions without persisting
  if (parsed.data.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(request);
  const rl = await enforceRateLimit(buildRateLimitKey("contact", ip), 5, 900);
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح للإرسال، يرجى المحاولة بعد 15 دقيقة" },
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
    const { error } = await admin.from("contact_messages").insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      business_name: parsed.data.business_name || null,
      message: parsed.data.message,
    });

    if (error) {
      return NextResponse.json(
        { error: "تعذر إرسال الطلب حالياً، يرجى المحاولة لاحقاً" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "تعذر إرسال الطلب حالياً، يرجى المحاولة لاحقاً" },
      { status: 503 }
    );
  }
}
