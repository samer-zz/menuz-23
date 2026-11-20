import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifySameOrigin } from "@/lib/security";

const contactSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب"),
  phone: z.string().trim().min(7, "رقم الهاتف مطلوب"),
  business_name: z.string().trim().optional().default(""),
  message: z.string().trim().min(5, "الرسالة مطلوبة"),
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
}
