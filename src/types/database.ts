export type UserRole = "super_admin" | "client_admin";

export type MenuBadge =
  | "best_seller"
  | "new"
  | "limited_offer"
  | "unavailable";

export interface Tenant {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  story: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  has_delivery: boolean;
  delivery_note: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  accent_color: string;
  currency: string;
  is_active: boolean;
  is_demo: boolean;
  suspended_message: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  badges: MenuBadge[];
  sort_order: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  badge_text: string;
  discount_text: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  tenant_id: string;
  name: string;
  account_number: string;
  account_name: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TenantNotification {
  id: string;
  tenant_id: string;
  title: string;
  body: string;
  expires_at: string;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  event_type: "menu_scan" | "item_view" | "order_submit";
  item_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  business_name: string | null;
  message: string;
  status: "new" | "reviewed" | "resolved";
  created_at: string;
}
