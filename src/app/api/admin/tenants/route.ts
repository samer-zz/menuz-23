import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { sanitizeSafeUrl, verifySameOrigin, writeAuditLog } from "@/lib/security";

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

const safeOptionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .refine((val) => !val || sanitizeSafeUrl(val) !== null, {
    message: "الرابط غير صالح أو غير آمن",
  });

const tenantSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "المعرف يجب أن يحتوي على حروف إنجليزية وأرقام وشرطات فقط"),
  name_ar: z.string().trim().min(2, "الاسم بالعربية مطلوب").max(150),
  name_en: z.string().trim().max(150).optional().nullable(),
  story: z.string().max(1500).optional().nullable(),
  description: z.string().max(600).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  instagram: z.string().max(250).optional().nullable(),
  facebook: z.string().max(250).optional().nullable(),
  tiktok: z.string().max(250).optional().nullable(),
  has_delivery: z.boolean().default(true),
  delivery_note: z.string().max(300).optional().nullable(),
  logo_url: safeOptionalUrl,
  cover_url: safeOptionalUrl,
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "صيغة اللون الأساسي غير صالحة")
    .default("#0B2D5B"),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "صيغة اللون الثانوي غير صالحة")
    .default("#FF7A00"),
  currency: z.string().trim().min(1).max(20).default("ر.ي"),
  is_active: z.boolean().default(true),
  is_demo: z.boolean().optional(),
  seedDemoTemplate: z.boolean().optional(),
  suspended_message: z.string().max(500).optional(),
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

  const { id: _unusedId, seedDemoTemplate, ...payload } = parsed.data;
  void _unusedId;

  const { data, error } = await ctx.supabase
    .from("tenants")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (seedDemoTemplate && data?.id) {
    const { data: catMain } = await ctx.supabase
      .from("categories")
      .insert({
        tenant_id: data.id,
        name: "وجبات مميزة",
        description: "قالب مبدئي — يمكنك تعديله أو استبداله",
        sort_order: 1,
        is_active: true,
      })
      .select("id")
      .single();

    const { data: catDrinks } = await ctx.supabase
      .from("categories")
      .insert({
        tenant_id: data.id,
        name: "المشروبات",
        description: "مشروبات باردة وساخنة",
        sort_order: 2,
        is_active: true,
      })
      .select("id")
      .single();

    if (catMain && catDrinks) {
      await ctx.supabase.from("menu_items").insert([
        {
          tenant_id: data.id,
          category_id: catMain.id,
          name: "صنف تجريبي أول",
          ingredients: "وصف مكونات الصنف يظهر هنا",
          price: 1000,
          is_available: true,
          is_featured: true,
          badges: ["best_seller"],
          sort_order: 1,
        },
        {
          tenant_id: data.id,
          category_id: catDrinks.id,
          name: "مشروب تجريبي",
          ingredients: "منعش وطازج",
          price: 400,
          is_available: true,
          is_featured: false,
          badges: ["new"],
          sort_order: 2,
        },
      ]);
    }
  }

  await writeAuditLog({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email ?? null,
    action: "create_tenant",
    targetType: "tenant",
    targetId: data.id,
    details: {
      slug: data.slug,
      name_ar: data.name_ar,
      seedDemoTemplate: Boolean(seedDemoTemplate),
    },
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

  const rawId = request.nextUrl.searchParams.get("id");
  const parsedId = z.string().uuid().safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "معرف الجهة غير صالح" }, { status: 400 });
  }
  const id = parsedId.data;

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
