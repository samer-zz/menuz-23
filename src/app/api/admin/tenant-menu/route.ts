import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsedId = z
    .string()
    .uuid()
    .safeParse(request.nextUrl.searchParams.get("tenantId"));
  if (!parsedId.success) {
    return NextResponse.json({ error: "معرف الجهة غير صالح" }, { status: 400 });
  }

  const tenantId = parsedId.data;
  const [catsRes, itemsRes, offersRes, walletsRes, notifsRes] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("offers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  return NextResponse.json({
    ok: true,
    categories: catsRes.data ?? [],
    items: itemsRes.data ?? [],
    offers: offersRes.data ?? [],
    wallets: walletsRes.data ?? [],
    notifications: notifsRes.data ?? [],
  });
}
