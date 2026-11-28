import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
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

const PUBLIC_TENANT_COLUMNS =
  "id, slug, name_ar, name_en, story, description, address, phone, whatsapp, instagram, facebook, tiktok, has_delivery, delivery_note, logo_url, cover_url, primary_color, accent_color, currency, is_active, is_demo";

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
      title: "منيو رقمي | مينوز",
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
    icons: {
      icon: `/api/manifest/${tenant.slug}/icon?size=192`,
      apple: `/api/manifest/${tenant.slug}/icon?size=180`,
    },
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

  const { data: activeTenantData } = await supabase
    .from("tenants")
    .select(PUBLIC_TENANT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (!activeTenantData) {
    // Check safely on server whether this slug exists in a suspended state
    const admin = createAdminSupabase();
    const { data: suspendedData } = await admin
      .from("tenants")
      .select(
        "id, slug, name_ar, name_en, logo_url, primary_color, accent_color, currency, is_active, is_demo, suspended_message"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (!suspendedData) {
      notFound();
    }

    const sanitizedSuspendedTenant: Tenant = {
      id: suspendedData.id,
      slug: suspendedData.slug,
      name_ar: suspendedData.name_ar,
      name_en: suspendedData.name_en,
      story: null,
      description: null,
      address: null,
      phone: null,
      whatsapp: null,
      instagram: null,
      facebook: null,
      tiktok: null,
      has_delivery: false,
      delivery_note: null,
      logo_url: suspendedData.logo_url,
      cover_url: null,
      primary_color: suspendedData.primary_color,
      accent_color: suspendedData.accent_color,
      currency: suspendedData.currency,
      is_active: false,
      is_demo: Boolean(suspendedData.is_demo),
      suspended_message:
        suspendedData.suspended_message ||
        "نعتذر، هذا المنيو متوقف مؤقتاً للصيانة والتحديث.",
      created_at: "",
      updated_at: "",
    };

    return (
      <PublicMenuClient
        tenant={sanitizedSuspendedTenant}
        categories={[]}
        items={[]}
        offers={[]}
        wallets={[]}
        initialNotifications={[]}
      />
    );
  }

  const tenant = {
    ...(activeTenantData as Omit<
      Tenant,
      "suspended_message" | "created_at" | "updated_at"
    >),
    suspended_message: "",
    created_at: "",
    updated_at: "",
  } as Tenant;

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

  // Optional v4 appearance columns from migration 005 (graceful fallback if not yet applied)
  try {
    const admin = createAdminSupabase();
    const { data: extraColors } = await admin
      .from("tenants")
      .select("background_color, card_color, text_color, button_text_color")
      .eq("id", tenant.id)
      .maybeSingle();
    if (extraColors) {
      Object.assign(tenant, extraColors);
    }
  } catch {
    // Ignore cleanly before migration 005 is applied
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
