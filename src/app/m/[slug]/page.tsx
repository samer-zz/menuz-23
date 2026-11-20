import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicMenuClient } from "@/components/menu/public-menu-client";
import type {
  Category,
  MenuItem,
  Offer,
  Tenant,
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
    .select("name_ar, name_en, description, logo_url, cover_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    return { title: "منيو غير موجود" };
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
      />
    );
  }

  const [catsRes, itemsRes, offersRes, walletsRes] = await Promise.all([
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
  ]);

  return (
    <PublicMenuClient
      tenant={tenant}
      categories={(catsRes.data as Category[]) ?? []}
      items={(itemsRes.data as MenuItem[]) ?? []}
      offers={(offersRes.data as Offer[]) ?? []}
      wallets={(walletsRes.data as Wallet[]) ?? []}
    />
  );
}
