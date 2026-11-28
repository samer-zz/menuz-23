import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { validateStrongPassword } from "@/lib/utils";
import { verifySameOrigin, writeAuditLog } from "@/lib/security";

const schema = z.object({
  newPassword: z.string().min(8).max(128),
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
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "كلمة المرور غير صالحة" },
      { status: 400 }
    );
  }

  const check = validateStrongPassword(parsed.data.newPassword);
  if (!check.valid) {
    return NextResponse.json(
      { error: check.errors.join(" • ") },
      { status: 400 }
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "password_changed",
    targetType: "profile",
    targetId: user.id,
  });

  return NextResponse.json({ ok: true });
}
