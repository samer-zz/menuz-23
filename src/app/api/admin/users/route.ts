import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { validateStrongPassword } from "@/lib/utils";
import { verifySameOrigin, writeAuditLog } from "@/lib/security";

async function requireSuperAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") return null;
  return user;
}

const createAccountSchema = z.object({
  email: z.string().trim().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8),
  fullName: z.string().trim().min(2, "الاسم مطلوب"),
  role: z.enum(["client_admin", "super_admin"]).default("client_admin"),
  tenantId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 }
    );
  }

  const passCheck = validateStrongPassword(parsed.data.password);
  if (!passCheck.valid) {
    return NextResponse.json(
      { error: passCheck.errors.join(" • ") },
      { status: 400 }
    );
  }

  if (parsed.data.role === "client_admin" && !parsed.data.tenantId) {
    return NextResponse.json(
      { error: "يجب اختيار الجهة المرتبطة بحساب العميل" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message || "تعذر إنشاء المستخدم" },
      { status: 400 }
    );
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    email: parsed.data.email.toLowerCase(),
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    tenant_id: parsed.data.role === "client_admin" ? parsed.data.tenantId : null,
    must_change_password: true,
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email ?? null,
    action: "create_user_account",
    targetType: "profile",
    targetId: created.user.id,
    details: {
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      tenant_id: parsed.data.tenantId ?? null,
    },
  });

  return NextResponse.json({ ok: true, userId: created.user.id });
}

export async function DELETE(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("id");
  if (!userId || userId === actor.id) {
    return NextResponse.json(
      { error: "لا يمكن حذف هذا الحساب" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email ?? null,
    action: "delete_user_account",
    targetType: "profile",
    targetId: userId,
  });

  return NextResponse.json({ ok: true });
}
