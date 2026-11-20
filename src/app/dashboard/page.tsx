import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ClientDashboardClient } from "@/components/dashboard/client-dashboard-client";
import type {
  AnalyticsEvent,
  Category,
  MenuItem,
  Offer,
  Profile,
  Tenant,
  Wallet,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profileData) redirect("/login");
  const profile = profileData as Profile;

  if (profile.role === "super_admin" && !profile.tenant_id) {
    redirect("/admin");
  }

  let tenant: Tenant | null = null;
  let categories: Category[] = [];
  let items: MenuItem[] = [];
  let offers: Offer[] = [];
  let wallets: Wallet[] = [];
  let events: AnalyticsEvent[] = [];

  if (profile.tenant_id) {
    const [tRes, cRes, iRes, oRes, wRes, eRes] = await Promise.all([
      supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .maybeSingle(),
      supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("offers")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("analytics_events")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    tenant = (tRes.data as Tenant) ?? null;
    categories = (cRes.data as Category[]) ?? [];
    items = (iRes.data as MenuItem[]) ?? [];
    offers = (oRes.data as Offer[]) ?? [];
    wallets = (wRes.data as Wallet[]) ?? [];
    events = (eRes.data as AnalyticsEvent[]) ?? [];
  }

  return (
    <ClientDashboardClient
      profile={profile}
      tenant={tenant}
      categories={categories}
      items={items}
      offers={offers}
      wallets={wallets}
      events={events}
    />
  );
}
