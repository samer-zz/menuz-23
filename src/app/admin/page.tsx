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
  OrderFeedback,
  OrderRecord,
  Profile,
  Tenant,
  TenantNotification,
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
    notificationsRes,
    eventsRes,
    auditRes,
    messagesRes,
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(1000),
    supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(2000),
    supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("wallets")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(500),
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  // Optional 005 tables: orders & super-admin-only order_feedback (graceful fallback if unapplied)
  let orders: OrderRecord[] = [];
  let feedbacks: OrderFeedback[] = [];

  try {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (ordersData) orders = ordersData as OrderRecord[];
  } catch {
    orders = [];
  }

  try {
    const { data: fbData } = await supabase
      .from("order_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (fbData) feedbacks = fbData as OrderFeedback[];
  } catch {
    feedbacks = [];
  }

  const auditLogs = (auditRes.data as AuditLog[]) ?? [];
  if (feedbacks.length === 0) {
    // Also surface pre-005 feedback captured securely in super-admin-only audit_logs
    feedbacks = auditLogs
      .filter((a) => a.action === "order_experience_feedback")
      .map((a) => ({
        id: a.id,
        tenant_id: a.target_id || "",
        order_id:
          typeof a.details?.order_id === "string" ? a.details.order_id : null,
        rating: Number(a.details?.rating) || 5,
        comment:
          typeof a.details?.comment === "string" ? a.details.comment : null,
        created_at: a.created_at,
      }));
  }

  return (
    <SuperAdminClient
      profile={profileData as Profile}
      tenants={(tenantsRes.data as Tenant[]) ?? []}
      profiles={(profilesRes.data as Profile[]) ?? []}
      categories={(categoriesRes.data as Category[]) ?? []}
      items={(itemsRes.data as MenuItem[]) ?? []}
      offers={(offersRes.data as Offer[]) ?? []}
      wallets={(walletsRes.data as Wallet[]) ?? []}
      notifications={(notificationsRes.data as TenantNotification[]) ?? []}
      events={(eventsRes.data as AnalyticsEvent[]) ?? []}
      auditLogs={auditLogs}
      messages={(messagesRes.data as ContactMessage[]) ?? []}
      orders={orders}
      feedbacks={feedbacks}
    />
  );
}
