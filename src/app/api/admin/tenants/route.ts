import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
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
  return { user, supabase };
}

const tenantSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "المعرف يجب أن يحتوي على حروف إنجليزية وأرقام وشرطات فقط"),
  name_ar: z.string().trim().min(2, "الاسم بالعربية مطلوب"),
  name_en: z.string().trim().optional().nullable(),
  story: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  tiktok: z.string().optional().nullable(),
  has_delivery: z.boolean().default(true),
  delivery_note: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  cover_url: z.string().optional().nullable(),
  primary_color: z.string().default("#0B2D5B"),
  accent_color: z.string().default("#FF7A00"),
  currency: z.string().default("ر.ي"),
  is_active: z.boolean().default(true),
  suspended_message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = tenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 }
    );
  }

  const { id: _unusedId, ...payload } = parsed.data;
  void _unusedId;

  const { data, error } = await ctx.supabase
    .from("tenants")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email ?? null,
    action: "create_tenant",
    targetType: "tenant",
    targetId: data.id,
    details: { slug: data.slug, name_ar: data.name_ar },
  });

  return NextResponse.json({ ok: true, tenant: data });
}

export async function PATCH(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = tenantSchema.partial().extend({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email ?? null,
    action:
      "is_active" in updates
        ? updates.is_active
          ? "activate_tenant"
          : "suspend_tenant"
        : "update_tenant",
    targetType: "tenant",
    targetId: id,
    details: updates,
  });

  return NextResponse.json({ ok: true, tenant: data });
}

export async function DELETE(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "معرف الجهة مطلوب" }, { status: 400 });
  }

  const { error } = await ctx.supabase.from("tenants").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email ?? null,
    action: "delete_tenant",
    targetType: "tenant",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
