import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicMenuClient } from "@/components/menu/public-menu-client";
import type {
  Category,
  MenuItem,
  Offer,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, name_ar, name_en, description, logo_url, cover_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    return {
      title: "منيو غير موجود",
      manifest: "/api/manifest/default",
    };
  }

  const title = tenant.name_en
    ? `${tenant.name_ar} (${tenant.name_en}) | منيو رقمي`
    : `${tenant.name_ar} | منيو رقمي`;

  const description =
    tenant.description ||
    `تصفح قائمة الطعام واطلب مباشرة من ${tenant.name_ar} عبر منصة مينوز MENUZ`;

  return {
    title,
    description,
    manifest: `/api/manifest/${tenant.slug}`,
    openGraph: {
      title,
      description,
      images: tenant.cover_url
        ? [tenant.cover_url]
        : tenant.logo_url
          ? [tenant.logo_url]
          : ["/branding/menuz_brand_showcase.png"],
    },
  };
}

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabase();

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenantData) {
    notFound();
  }

  const tenant = tenantData as Tenant;

  if (!tenant.is_active) {
    return (
      <PublicMenuClient
        tenant={tenant}
        categories={[]}
        items={[]}
        offers={[]}
        wallets={[]}
        initialNotifications={[]}
      />
    );
  }

  const nowIso = new Date().toISOString();

  const [catsRes, itemsRes, offersRes, walletsRes, notifRes] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("offers")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenant.id)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <PublicMenuClient
      tenant={tenant}
      categories={(catsRes.data as Category[]) ?? []}
      items={(itemsRes.data as MenuItem[]) ?? []}
      offers={(offersRes.data as Offer[]) ?? []}
      wallets={(walletsRes.data as Wallet[]) ?? []}
      initialNotifications={(notifRes.data as TenantNotification[]) ?? []}
    />
  );
}
