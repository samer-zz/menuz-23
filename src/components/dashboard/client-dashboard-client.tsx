"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Utensils,
  KeyRound,
  QrCode,
  ExternalLink,
  LogOut,
  AlertTriangle,
  Sun,
  Moon,
  Shield,
  ShoppingBag,
} from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import { createClient } from "@/lib/supabase/client";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { TenantMenuManager } from "./tenant-menu-manager";
import { AnalyticsCharts } from "./analytics-charts";
import { PasswordChangeCard } from "./password-change-card";
import { QrGeneratorModal } from "./qr-generator-modal";
import { cn, formatArabicDate, formatPrice } from "@/lib/utils";
import type {
  AnalyticsEvent,
  Category,
  MenuItem,
  Offer,
  OrderRecord,
  Profile,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

type Tab = "menu" | "orders" | "analytics" | "security";

export function ClientDashboardClient({
  profile,
  tenant,
  categories,
  items,
  offers,
  wallets,
  notifications = [],
  events,
  orders = [],
}: {
  profile: Profile;
  tenant: Tenant | null;
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
  notifications?: TenantNotification[];
  events: AnalyticsEvent[];
  orders?: OrderRecord[];
}) {
  const router = useRouter();
  const { theme, toggleTheme, toast } = useApp();
  const [tab, setTab] = useState<Tab>("menu");
  const [showQr, setShowQr] = useState(false);
  const [mustChange, setMustChange] = useState(profile.must_change_password);
  const [orderList, setOrderList] = useState<OrderRecord[]>(orders);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: OrderRecord["status"]
  ) => {
    setUpdatingOrderId(orderId);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_tenant_order_status", {
        p_order_id: orderId,
        p_new_status: newStatus,
      });
      if (error) {
        toast("تعذر تحديث حالة الطلب", "error");
        return;
      }
      setOrderList((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast("تم تحديث حالة الطلب بنجاح", "success");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("تم تسجيل الخروج", "info");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-navy-700/10 dark:border-white/10 bg-white/85 dark:bg-[#040E21]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <MenuzLogo height={38} />
            </Link>
            <div className="hidden sm:block border-r border-white/15 pr-3">
              <p className="text-xs text-slate-400">لوحة إدارة المنشأة</p>
              <p className="font-extrabold text-sm">
                {tenant?.name_ar || profile.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tenant && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 hover:bg-brand-orange hover:text-white transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span className="hidden sm:inline">رمز QR</span>
                </button>
                <a
                  href={`/m/${tenant.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold glass-panel hover:border-brand-orange/50"
                >
                  <ExternalLink className="w-4 h-4 text-brand-orange" />
                  <span className="hidden sm:inline">عرض المنيو</span>
                </a>
              </>
            )}

            {profile.role === "super_admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold bg-navy-700 text-white"
              >
                <Shield className="w-4 h-4 text-brand-orange" />
                <span>لوحة السوبر أدمن</span>
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl glass-panel"
              aria-label="تبديل المظهر"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-brand-amber" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {mustChange && (
          <div className="rounded-2xl p-4 bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-bold text-amber-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                تنبيه أمني: أنت تستخدم كلمة المرور الأولية. يُلزم بتغيير كلمة
                المرور خلال 72 ساعة لحماية حسابك.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab("security")}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-navy-950"
            >
              تغيير كلمة المرور الآن
            </button>
          </div>
        )}

        {!tenant ? (
          <div className="rounded-3xl p-10 text-center glass-panel space-y-3">
            <h1 className="text-xl font-extrabold">
              حسابك غير مرتبط بجهة حالياً
            </h1>
            <p className="text-sm text-slate-400">
              تواصل مع مدير النظام على الرقم 776951100 لربط منشأتك.
            </p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "menu", label: "إدارة المنيو والعروض", icon: Utensils },
                  { key: "orders", label: `الطلبات (${orderList.length})`, icon: ShoppingBag },
                  { key: "analytics", label: "إحصائيات الجهة", icon: BarChart3 },
                  { key: "security", label: "الأمان وكلمة المرور", icon: KeyRound },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition",
                    tab === t.key
                      ? "bg-orange-gradient text-white border-transparent shadow-orange-glow"
                      : "glass-panel hover:border-brand-orange/50"
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {tab === "menu" && (
              <TenantMenuManager
                tenant={tenant}
                categories={categories}
                items={items}
                offers={offers}
                wallets={wallets}
                notifications={notifications}
              />
            )}

            {tab === "orders" && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4 glass-panel flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    تُسجَّل هنا الطلبات المرسلة عبر سلة المنيو بإجماليات محققة
                    من قاعدة البيانات لمنع التلاعب بالأسعار.
                  </span>
                </div>
                {orderList.length === 0 ? (
                  <div className="rounded-3xl p-10 text-center glass-panel text-slate-400 text-sm">
                    لا توجد طلبات مسجلة في سجل الطلبات بعد.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderList.map((ord) => (
                      <div
                        key={ord.id}
                        className="rounded-2xl p-4 glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-black text-brand-orange">
                              #{ord.order_number}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-bold">
                              {ord.order_type === "delivery" ? "توصيل" : "استلام"}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                              {ord.channel === "whatsapp" ? "واتساب" : ord.channel === "sms" ? "رسالة نصية" : "مباشر"}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange font-bold">
                              {ord.status === "sent"
                                ? "مرسل"
                                : ord.status === "confirmed"
                                  ? "مؤكد"
                                  : ord.status === "completed"
                                    ? "مكتمل"
                                    : "ملغي"}
                            </span>
                          </div>
                          <p className="text-sm font-bold">
                            {ord.customer_name || "عميل بدون اسم"}{" "}
                            {ord.customer_phone ? `• ${ord.customer_phone}` : ""}
                          </p>
                          <p className="text-xs text-slate-400">
                            {Array.isArray(ord.items_snapshot)
                              ? ord.items_snapshot
                                  .map((s) => `${s.name} × ${s.quantity}`)
                                  .join("، ")
                              : ""}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatArabicDate(ord.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-left">
                            <p className="font-black text-base text-brand-orange">
                              {formatPrice(ord.computed_total, ord.currency)}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {ord.payment_method === "wallet" ? "محفظة إلكترونية" : "نقداً"}
                            </p>
                          </div>
                          {(ord.status === "sent" || ord.status === "confirmed") && (
                            <div className="flex items-center gap-1.5">
                              {ord.status === "sent" && (
                                <button
                                  type="button"
                                  disabled={updatingOrderId === ord.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(ord.id, "confirmed")
                                  }
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition"
                                >
                                  تأكيد
                                </button>
                              )}
                              {ord.status === "confirmed" && (
                                <button
                                  type="button"
                                  disabled={updatingOrderId === ord.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(ord.id, "completed")
                                  }
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition"
                                >
                                  إكمال
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={updatingOrderId === ord.id}
                                onClick={() =>
                                  handleUpdateOrderStatus(ord.id, "cancelled")
                                }
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "analytics" && (
              <AnalyticsCharts events={events} items={items} />
            )}

            {tab === "security" && (
              <PasswordChangeCard
                mustChangePassword={mustChange}
                onSuccess={() => setMustChange(false)}
              />
            )}
          </>
        )}
      </main>

      {showQr && tenant && (
        <QrGeneratorModal tenant={tenant} onClose={() => setShowQr(false)} />
      )}
    </div>
  );
}
