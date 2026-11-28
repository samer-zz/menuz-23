import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  enforceRateLimit,
  getClientIp,
  verifySameOrigin,
  writeAuditLog,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const allowed = await enforceRateLimit(`demo:${ip}`, 20, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "يرجى الانتظار قليلاً قبل إعادة المحاولة" },
      { status: 429 }
    );
  }

  try {
    const supabase = await createServerSupabase();

    // 1. Check via anon/session RLS first (only active demo tenant is visible publicly)
    const { data: activeDemo } = await supabase
      .from("tenants")
      .select("id, slug, is_active, is_demo")
      .eq("slug", "demo")
      .eq("is_active", true)
      .maybeSingle();

    if (activeDemo) {
      return NextResponse.json({ ok: true, slug: "demo", url: "/m/demo" });
    }

    // 2. If demo is missing or suspended, ONLY an authenticated super_admin may provision/reactivate it
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "المنيو التجريبي غير متاح حالياً" },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "المنيو التجريبي متوقف حالياً من الإدارة" },
        { status: 403 }
      );
    }

    const admin = createAdminSupabase();
    const { data: existing } = await admin
      .from("tenants")
      .select("id, slug, is_active")
      .eq("slug", "demo")
      .maybeSingle();

    if (existing) {
      await admin
        .from("tenants")
        .update({ is_active: true, is_demo: true })
        .eq("id", existing.id);

      await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: "reactivate_demo_tenant",
        targetType: "tenant",
        targetId: existing.id,
      });

      return NextResponse.json({ ok: true, slug: "demo", url: "/m/demo" });
    }

    const { data: created, error: createErr } = await admin
      .from("tenants")
      .insert({
        slug: "demo",
        name_ar: "مطعم مينوز التجريبي",
        name_en: "MENUZ DEMO",
        story:
          "منيو تجريبي تفاعلي يستعرض إمكانات منصة مينوز v3.0 من شركة سامرز للحلول الذكية.",
        description:
          "نموذج حي لمنيو رقمي متكامل: وجبات سريعة، مشروبات منعشة، وحلويات فاخرة.",
        address: "صنعاء - شارع القيادة - نموذج عرض تفاعلي",
        phone: "776951100",
        whatsapp: "967776951100",
        instagram: "menuz.app",
        has_delivery: true,
        delivery_note: "توصيل تجريبي سريع خلال 30 دقيقة",
        logo_url: "/branding/menuz_mark_white.png",
        cover_url:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
        primary_color: "#0B2D5B",
        accent_color: "#FF7A00",
        currency: "ر.ي",
        is_active: true,
        is_demo: true,
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return NextResponse.json(
        { error: "تعذر إنشاء المنيو التجريبي" },
        { status: 500 }
      );
    }

    const { data: catFast } = await admin
      .from("categories")
      .insert({
        tenant_id: created.id,
        name: "وجبات سريعة",
        description: "برجر، بيتزا، ومقرمشات طازجة",
        sort_order: 1,
        is_active: true,
      })
      .select("id")
      .single();

    const { data: catDrinks } = await admin
      .from("categories")
      .insert({
        tenant_id: created.id,
        name: "مشروبات",
        description: "قهوة مختصة وعصائر باردة",
        sort_order: 2,
        is_active: true,
      })
      .select("id")
      .single();

    if (catFast && catDrinks) {
      await admin.from("menu_items").insert([
        {
          tenant_id: created.id,
          category_id: catFast.id,
          name: "برجر سماش كلاسيك دبل",
          ingredients: "لحم طازج، جبن شيدر، خبز بريوش",
          price: 1800,
          image_url:
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
          is_available: true,
          is_featured: true,
          badges: ["best_seller"],
          sort_order: 1,
        },
        {
          tenant_id: created.id,
          category_id: catDrinks.id,
          name: "آيس سبانيش لاتيه",
          ingredients: "قهوة مختصة، حليب بارد، ثلج",
          price: 1100,
          image_url:
            "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80",
          is_available: true,
          is_featured: true,
          badges: ["new"],
          sort_order: 2,
        },
      ]);
    }

    await admin.from("wallets").insert({
      tenant_id: created.id,
      name: "جيب (نموذج تجريبي)",
      account_number: "776951100",
      account_name: "حساب مينوز التجريبي",
      is_active: true,
      sort_order: 1,
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "provision_demo_tenant",
      targetType: "tenant",
      targetId: created.id,
    });

    return NextResponse.json({ ok: true, slug: "demo", url: "/m/demo" });
  } catch {
    return NextResponse.json(
      { error: "تعذر الوصول إلى المنيو التجريبي" },
      { status: 500 }
    );
  }
}
