import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SuperAdminClient } from "@/components/admin/super-admin-client";
import type {
  AnalyticsEvent,
  AuditLog,
  Category,
  ContactMessage,
  MenuItem,
  Offer,
  Profile,
  Tenant,
  Wallet,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  if (!profileData || profileData.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [
    tenantsRes,
    profilesRes,
    categoriesRes,
    itemsRes,
    offersRes,
    walletsRes,
    eventsRes,
    auditRes,
    messagesRes,
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("wallets")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <SuperAdminClient
      profile={profileData as Profile}
      tenants={(tenantsRes.data as Tenant[]) ?? []}
      profiles={(profilesRes.data as Profile[]) ?? []}
      categories={(categoriesRes.data as Category[]) ?? []}
      items={(itemsRes.data as MenuItem[]) ?? []}
      offers={(offersRes.data as Offer[]) ?? []}
      wallets={(walletsRes.data as Wallet[]) ?? []}
      events={(eventsRes.data as AnalyticsEvent[]) ?? []}
      auditLogs={(auditRes.data as AuditLog[]) ?? []}
      messages={(messagesRes.data as ContactMessage[]) ?? []}
    />
  );
}
