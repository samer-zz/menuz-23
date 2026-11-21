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
} from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { TenantMenuManager } from "./tenant-menu-manager";
import { AnalyticsCharts } from "./analytics-charts";
import { PasswordChangeCard } from "./password-change-card";
import { QrGeneratorModal } from "./qr-generator-modal";
import { cn } from "@/lib/utils";
import type {
  AnalyticsEvent,
  Category,
  MenuItem,
  Offer,
  Profile,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

type Tab = "menu" | "analytics" | "security";

export function ClientDashboardClient({
  profile,
  tenant,
  categories,
  items,
  offers,
  wallets,
  notifications = [],
  events,
}: {
  profile: Profile;
  tenant: Tenant | null;
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
  notifications?: TenantNotification[];
  events: AnalyticsEvent[];
}) {
  const router = useRouter();
  const { theme, toggleTheme, toast } = useApp();
  const [tab, setTab] = useState<Tab>("menu");
  const [showQr, setShowQr] = useState(false);
  const [mustChange, setMustChange] = useState(profile.must_change_password);

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
