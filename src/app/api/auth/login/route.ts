import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifySameOrigin } from "@/lib/security";

const loginSchema = z.object({
  email: z.string().trim().email("البريد الإلكتروني غير صالح").max(160),
  password: z.string().min(6, "كلمة المرور مطلوبة").max(128),
});

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateKey = `${ip}:${email}`;

  const admin = createAdminSupabase();
  const now = new Date();

  const { data: rateRow } = await admin
    .from("login_rate_limits")
    .select("*")
    .eq("key", rateKey)
    .maybeSingle();

  if (rateRow?.locked_until && new Date(rateRow.locked_until) > now) {
    const minsLeft = Math.ceil(
      (new Date(rateRow.locked_until).getTime() - now.getTime()) / 60000
    );
    return NextResponse.json(
      {
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${minsLeft} دقيقة ثم المحاولة مرة أخرى.`,
      },
      { status: 429 }
    );
  }

  const supabase = await createServerSupabase();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

  if (authError || !authData.user) {
    const windowExpired =
      !rateRow ||
      now.getTime() - new Date(rateRow.window_start).getTime() > WINDOW_MS;
    const nextAttempts = windowExpired ? 1 : (rateRow?.attempts ?? 0) + 1;
    const lockedUntil =
      nextAttempts >= MAX_ATTEMPTS
        ? new Date(now.getTime() + WINDOW_MS).toISOString()
        : null;

    await admin.from("login_rate_limits").upsert({
      key: rateKey,
      attempts: nextAttempts,
      window_start: windowExpired ? now.toISOString() : rateRow.window_start,
      locked_until: lockedUntil,
    });

    const remaining = Math.max(0, MAX_ATTEMPTS - nextAttempts);
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `البريد الإلكتروني أو كلمة المرور غير صحيحة (متبقي ${remaining} محاولات).`
            : "تم قفل تسجيل الدخول مؤقتاً لمدة 15 دقيقة بسبب تكرار المحاولات الخاطئة.",
      },
      { status: 401 }
    );
  }

  // Clear rate limit on successful login
  await admin.from("login_rate_limits").delete().eq("key", rateKey);

  const { data: profile } = await admin
    .from("profiles")
    .select("role, tenant_id, must_change_password")
    .eq("id", authData.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "لم يتم تفعيل ملف الصلاحيات لهذا الحساب بعد." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    role: profile.role,
    mustChangePassword: profile.must_change_password,
    redirectTo: profile.role === "super_admin" ? "/admin" : "/dashboard",
  });
}
