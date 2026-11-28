"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Users,
  MessageSquare,
  ShieldCheck,
  KeyRound,
  Plus,
  QrCode,
  ExternalLink,
  LogOut,
  Power,
  Edit3,
  Trash2,
  Upload,
  X,
  Utensils,
  AlertTriangle,
  Sun,
  Moon,
  FileText,
  FlaskConical,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  compressImageFile,
  MAX_CLIENT_IMAGE_BYTES,
  validateImageFile,
} from "@/lib/image-compress";
import { useApp } from "@/components/providers/theme-provider";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { PasswordChangeCard } from "@/components/dashboard/password-change-card";
import { QrGeneratorModal } from "@/components/dashboard/qr-generator-modal";
import { TenantMenuManager } from "@/components/dashboard/tenant-menu-manager";
import { cn, formatArabicDate } from "@/lib/utils";
import type {
  AnalyticsEvent,
  AuditLog,
  Category,
  ContactMessage,
  MenuItem,
  Offer,
  Profile,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

type AdminTab =
  | "overview"
  | "tenants"
  | "accounts"
  | "messages"
  | "audit"
  | "security";

export function SuperAdminClient({
  profile,
  tenants: initialTenants,
  profiles: initialProfiles,
  categories: initialCategories,
  items: initialItems,
  offers: initialOffers,
  wallets: initialWallets,
  notifications: initialNotifications = [],
  events,
  auditLogs,
  messages: initialMessages,
}: {
  profile: Profile;
  tenants: Tenant[];
  profiles: Profile[];
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
  notifications?: TenantNotification[];
  events: AnalyticsEvent[];
  auditLogs: AuditLog[];
  messages: ContactMessage[];
}) {
  const router = useRouter();
  const { theme, toggleTheme, toast } = useApp();
  const supabase = createClient();

  const [tab, setTab] = useState<AdminTab>("overview");
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages);
  const [mustChange, setMustChange] = useState(profile.must_change_password);
  const [qrTenant, setQrTenant] = useState<Tenant | null>(null);
  const [managingTenant, setManagingTenant] = useState<Tenant | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantPage, setTenantPage] = useState(1);
  const TENANTS_PER_PAGE = 12;

  // Tenant Create / Edit modal state
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tSlug, setTSlug] = useState("");
  const [tNameAr, setTNameAr] = useState("");
  const [tNameEn, setTNameEn] = useState("");
  const [tAddress, setTAddress] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tWhatsapp, setTWhatsapp] = useState("");
  const [tInstagram, setTInstagram] = useState("");
  const [tStory, setTStory] = useState("");
  const [tLogoUrl, setTLogoUrl] = useState("");
  const [tCoverUrl, setTCoverUrl] = useState("");
  const [tPrimaryColor, setTPrimaryColor] = useState("#0B2D5B");
  const [tAccentColor, setTAccentColor] = useState("#FF7A00");
  const [tCurrency, setTCurrency] = useState("ر.ي");
  const [tSuspendedMsg, setTSuspendedMsg] = useState(
    "نعتذر، هذا المنيو متوقف مؤقتاً للصيانة والتحديث."
  );
  const [tSeedDemo, setTSeedDemo] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);

  // User creation form
  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uFullName, setUFullName] = useState("");
  const [uRole, setURole] = useState<"client_admin" | "super_admin">("client_admin");
  const [uTenantId, setUTenantId] = useState(initialTenants[0]?.id || "");
  const [creatingUser, setCreatingUser] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("تم تسجيل الخروج", "info");
    router.push("/login");
    router.refresh();
  };

  const uploadAdminMedia = async (file: File, folder: string) => {
    const check = await validateImageFile(file);
    if (!check.valid) {
      toast(check.error, "error");
      return null;
    }

    setUploadingMedia(true);
    try {
      const compressed = await compressImageFile(file);
      if (compressed.size > MAX_CLIENT_IMAGE_BYTES) {
        toast("حجم الصورة يتجاوز الحد الأقصى المسموح (4 ميجابايت)", "error");
        return null;
      }
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("folder", folder);
      if (editingTenant?.id) {
        formData.append("tenantId", editingTenant.id);
      }

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        toast(data?.error || "فشل رفع الصورة", "error");
        return null;
      }
      toast("تم التحقق من الصورة ورفعها بنجاح", "success");
      return data.url as string;
    } catch {
      toast("تعذر الاتصال بخدمة رفع الصور", "error");
      return null;
    } finally {
      setUploadingMedia(false);
    }
  };

  const openNewTenant = () => {
    setEditingTenant(null);
    setTSlug("");
    setTNameAr("");
    setTNameEn("");
    setTAddress("");
    setTPhone("");
    setTWhatsapp("");
    setTInstagram("");
    setTStory("");
    setTLogoUrl("");
    setTCoverUrl("");
    setTPrimaryColor("#0B2D5B");
    setTAccentColor("#FF7A00");
    setTCurrency("ر.ي");
    setTSuspendedMsg("نعتذر، هذا المنيو متوقف مؤقتاً للصيانة والتحديث.");
    setTSeedDemo(false);
    setTenantModalOpen(true);
  };

  const openEditTenant = (t: Tenant) => {
    setEditingTenant(t);
    setTSlug(t.slug);
    setTNameAr(t.name_ar);
    setTNameEn(t.name_en || "");
    setTAddress(t.address || "");
    setTPhone(t.phone || "");
    setTWhatsapp(t.whatsapp || "");
    setTInstagram(t.instagram || "");
    setTStory(t.story || "");
    setTLogoUrl(t.logo_url || "");
    setTCoverUrl(t.cover_url || "");
    setTPrimaryColor(t.primary_color || "#0B2D5B");
    setTAccentColor(t.accent_color || "#FF7A00");
    setTCurrency(t.currency || "ر.ي");
    setTSuspendedMsg(t.suspended_message || "");
    setTenantModalOpen(true);
  };

  const saveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTenant(true);
    try {
      const payload = {
        ...(editingTenant ? { id: editingTenant.id } : {}),
        slug: tSlug.trim().toLowerCase(),
        name_ar: tNameAr.trim(),
        name_en: tNameEn.trim() || null,
        address: tAddress.trim() || null,
        phone: tPhone.trim() || null,
        whatsapp: tWhatsapp.trim() || null,
        instagram: tInstagram.trim() || null,
        story: tStory.trim() || null,
        logo_url: tLogoUrl.trim() || null,
        cover_url: tCoverUrl.trim() || null,
        primary_color: tPrimaryColor,
        accent_color: tAccentColor,
        currency: tCurrency,
        suspended_message: tSuspendedMsg,
        ...(!editingTenant ? { seedDemoTemplate: tSeedDemo } : {}),
      };

      const res = await fetch("/api/admin/tenants", {
        method: editingTenant ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "تعذر حفظ الجهة", "error");
        return;
      }

      if (editingTenant) {
        setTenants((p) =>
          p.map((x) => (x.id === editingTenant.id ? data.tenant : x))
        );
        toast("تم تحديث بيانات الجهة", "success");
      } else {
        setTenants((p) => [data.tenant, ...p]);
        toast("تم إنشاء الجهة بنجاح!", "success");
      }
      setTenantModalOpen(false);
    } finally {
      setSavingTenant(false);
    }
  };

  const toggleTenantActive = async (t: Tenant) => {
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "خطأ", "error");
    setTenants((p) => p.map((x) => (x.id === t.id ? data.tenant : x)));
    toast(
      data.tenant.is_active ? "تم تشغيل منيو الجهة" : "تم إيقاف منيو الجهة",
      "info"
    );
  };

  const deleteTenant = async (id: string) => {
    const res = await fetch(`/api/admin/tenants?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) return toast("تعذر حذف الجهة", "error");
    setTenants((p) => p.filter((x) => x.id !== id));
    toast("تم حذف الجهة", "info");
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uEmail,
          password: uPassword,
          fullName: uFullName,
          role: uRole,
          tenantId: uRole === "client_admin" ? uTenantId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || "تعذر إنشاء الحساب", "error");
      toast("تم إنشاء الحساب بنجاح!", "success");
      setUEmail("");
      setUPassword("");
      setUFullName("");
      router.refresh();
    } finally {
      setCreatingUser(false);
    }
  };

  const deleteAccount = async (id: string) => {
    const res = await fetch(`/api/admin/users?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "تعذر الحذف", "error");
    setProfiles((p) => p.filter((x) => x.id !== id));
    toast("تم حذف الحساب", "info");
  };

  const updateMessageStatus = async (
    id: string,
    status: ContactMessage["status"]
  ) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status })
      .eq("id", id);
    if (error) return toast(error.message, "error");
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, status } : m)));
    toast("تم تحديث حالة الرسالة", "success");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-navy-700/10 dark:border-white/10 bg-white/85 dark:bg-[#040E21]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <MenuzLogo height={38} />
            </Link>
            <div className="hidden sm:flex items-center gap-2 border-r border-white/15 pr-3">
              <ShieldCheck className="w-4 h-4 text-brand-orange" />
              <div>
                <p className="text-[11px] text-brand-orange font-bold">
                  SUPER ADMIN
                </p>
                <p className="font-extrabold text-sm">
                  الإدارة المركزية — سامرز
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span>خروج</span>
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
                سياسة الأمان: يرجى تغيير كلمة المرور الأولية لحساب Super Admin
                خلال 72 ساعة.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab("security")}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-navy-950"
            >
              تغيير الآن
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "overview", label: "الإحصائيات والمقارنة", icon: BarChart3 },
              { key: "tenants", label: `الجهات (${tenants.length})`, icon: Building2 },
              { key: "accounts", label: `الحسابات (${profiles.length})`, icon: Users },
              { key: "messages", label: `الطلبات (${messages.length})`, icon: MessageSquare },
              { key: "audit", label: "سجل التدقيق", icon: FileText },
              { key: "security", label: "حسابي", icon: KeyRound },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setManagingTenant(null);
                setTab(t.key);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold border transition",
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

        {/* OVERVIEW */}
        {tab === "overview" && (
          <AnalyticsCharts
            events={events}
            items={initialItems}
            tenants={tenants}
          />
        )}

        {/* TENANTS CRUD OR SUB-MENU MANAGEMENT */}
        {tab === "tenants" &&
          (managingTenant ? (
            <div className="space-y-5">
              <div className="rounded-2xl p-4 glass-panel flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Utensils className="w-5 h-5 text-brand-orange" />
                  <div>
                    <p className="text-xs text-slate-400">
                      تعديل منيو الجهة بصلاحية Super Admin
                    </p>
                    <h2 className="font-black text-lg">
                      {managingTenant.name_ar} (/m/{managingTenant.slug})
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManagingTenant(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/15 hover:border-brand-orange"
                >
                  العودة لقائمة الجهات
                </button>
              </div>

              <TenantMenuManager
                tenant={managingTenant}
                isSuperAdmin
                categories={initialCategories.filter(
                  (c) => c.tenant_id === managingTenant.id
                )}
                items={initialItems.filter(
                  (i) => i.tenant_id === managingTenant.id
                )}
                offers={initialOffers.filter(
                  (o) => o.tenant_id === managingTenant.id
                )}
                wallets={initialWallets.filter(
                  (w) => w.tenant_id === managingTenant.id
                )}
                notifications={initialNotifications.filter(
                  (n) => n.tenant_id === managingTenant.id
                )}
                onTenantUpdated={(updated) => {
                  setTenants((p) =>
                    p.map((x) => (x.id === updated.id ? updated : x))
                  );
                  setManagingTenant(updated);
                }}
              />
            </div>
          ) : (
            (() => {
              const filteredTenants = tenants.filter((t) => {
                const q = tenantSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  t.name_ar.toLowerCase().includes(q) ||
                  t.slug.toLowerCase().includes(q) ||
                  (t.name_en || "").toLowerCase().includes(q)
                );
              });
              const totalPages = Math.max(
                1,
                Math.ceil(filteredTenants.length / TENANTS_PER_PAGE)
              );
              const safePage = Math.min(tenantPage, totalPages);
              const pagedTenants = filteredTenants.slice(
                (safePage - 1) * TENANTS_PER_PAGE,
                safePage * TENANTS_PER_PAGE
              );
              const demoTenant = tenants.find((t) => t.is_demo);

              return (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black">
                        إدارة الجهات والمطاعم ({filteredTenants.length})
                      </h2>
                      <p className="text-xs text-slate-400">
                        تحميل مجزّأ جاهز لاستيعاب 150+ جهة بسلاسة
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {demoTenant && (
                        <button
                          type="button"
                          onClick={() => setManagingTenant(demoTenant)}
                          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold border border-brand-orange/40 bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition"
                        >
                          <FlaskConical className="w-4 h-4" />
                          <span>إدارة المنيو التجريبي</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openNewTenant}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة جهة جديدة</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Filter */}
                  <div className="relative max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={tenantSearch}
                      onChange={(e) => {
                        setTenantSearch(e.target.value);
                        setTenantPage(1);
                      }}
                      placeholder="ابحث باسم الجهة أو الـ slug..."
                      className="w-full rounded-xl pr-10 pl-4 py-2.5 text-sm bg-slate-100/90 dark:bg-navy-900/70 border border-navy-700/10 dark:border-white/15 focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pagedTenants.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "rounded-3xl p-5 glass-panel space-y-4",
                          t.is_demo && "border-brand-orange/45"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {t.logo_url ? (
                              <Image
                                src={t.logo_url}
                                alt={t.name_ar}
                                width={54}
                                height={54}
                                className="w-14 h-14 rounded-2xl object-cover border border-brand-orange/30 shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-navy-700 flex items-center justify-center font-black text-brand-orange text-xl shrink-0">
                                {t.name_ar.slice(0, 1)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-lg truncate">
                                  {t.name_ar}
                                </h3>
                                {t.is_demo && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange/20 text-brand-orange border border-brand-orange/35">
                                    <FlaskConical className="w-3 h-3" />
                                    <span>تجريبي</span>
                                  </span>
                                )}
                              </div>
                              <p
                                dir="ltr"
                                className="text-xs font-mono text-brand-orange"
                              >
                                /m/{t.slug}
                              </p>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold shrink-0",
                              t.is_active
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"
                            )}
                          >
                            {t.is_active ? "نشط" : "متوقف"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setManagingTenant(t)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                          >
                            <Utensils className="w-3.5 h-3.5" />
                            <span>المنيو</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditTenant(t)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold glass-card"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>الهوية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrTenant(t)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold glass-card"
                          >
                            <QrCode className="w-3.5 h-3.5 text-brand-orange" />
                            <span>QR</span>
                          </button>
                          <a
                            href={`/m/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold glass-card"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>فتح</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleTenantActive(t)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border",
                              t.is_active
                                ? "border-amber-500/30 text-amber-400"
                                : "border-emerald-500/30 text-emerald-400"
                            )}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{t.is_active ? "إيقاف" : "تشغيل"}</span>
                          </button>
                          {!t.is_demo && (
                            <button
                              type="button"
                              onClick={() => deleteTenant(t.id)}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10"
                              title="حذف الجهة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setTenantPage((p) => Math.max(1, p - 1))}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold glass-panel disabled:opacity-40"
                      >
                        السابق
                      </button>
                      <span className="text-xs font-bold px-3">
                        صفحة {safePage} من {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() =>
                          setTenantPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold glass-panel disabled:opacity-40"
                      >
                        التالي
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ))}

        {/* ACCOUNTS */}
        {tab === "accounts" && (
          <div className="space-y-6">
            <form
              onSubmit={createAccount}
              className="rounded-3xl p-6 glass-panel space-y-4"
            >
              <h2 className="font-extrabold text-lg">
                إنشاء حساب مدير جهة جديد
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="الاسم الكامل *"
                  className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="email@menuz.app *"
                  className="rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
                <input
                  required
                  type="password"
                  dir="ltr"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="كلمة مرور قوية *"
                  className="rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
                <select
                  value={uRole}
                  onChange={(e) =>
                    setURole(e.target.value as "client_admin" | "super_admin")
                  }
                  className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                >
                  <option value="client_admin">Client Admin (مدير جهة)</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                {uRole === "client_admin" && (
                  <select
                    value={uTenantId}
                    onChange={(e) => setUTenantId(e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={creatingUser}
                className="rounded-xl px-5 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
              >
                {creatingUser ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </button>
            </form>

            <div className="space-y-2.5">
              {profiles.map((p) => {
                const t = tenants.find((x) => x.id === p.tenant_id);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl p-4 glass-panel flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {p.full_name || p.email}{" "}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange">
                          {p.role}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.email}
                        {t ? ` • الجهة: ${t.name_ar}` : ""}
                      </p>
                    </div>
                    {p.id !== profile.id && (
                      <button
                        type="button"
                        onClick={() => deleteAccount(p.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTACT MESSAGES */}
        {tab === "messages" && (
          <div className="space-y-3">
            <h2 className="text-xl font-black">طلبات الخدمة والاستفسارات</h2>
            {messages.length === 0 ? (
              <div className="rounded-3xl p-10 text-center glass-panel text-slate-400">
                لا توجد رسائل واردة حتى الآن.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl p-5 glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold">{m.name}</h3>
                      {m.business_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange">
                          {m.business_name}
                        </span>
                      )}
                    </div>
                    <p dir="ltr" className="text-xs font-mono text-brand-amber w-fit">
                      {m.phone}
                    </p>
                    <p className="text-sm text-slate-300">{m.message}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatArabicDate(m.created_at)}
                    </p>
                  </div>

                  <select
                    value={m.status}
                    onChange={(e) =>
                      updateMessageStatus(
                        m.id,
                        e.target.value as ContactMessage["status"]
                      )
                    }
                    className="rounded-xl px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-navy-900 border border-white/15"
                  >
                    <option value="new">جديد</option>
                    <option value="reviewed">قيد المتابعة</option>
                    <option value="resolved">مكتمل</option>
                  </select>
                </div>
              ))
            )}
          </div>
        )}

        {/* AUDIT LOG */}
        {tab === "audit" && (
          <div className="space-y-3">
            <h2 className="text-xl font-black">سجل التدقيق (Audit Log)</h2>
            <div className="rounded-3xl overflow-hidden glass-panel divide-y divide-white/10">
              {auditLogs.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  لا توجد عمليات مسجلة بعد.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-brand-orange">
                        {log.action}
                      </span>{" "}
                      <span className="text-slate-400">
                        ({log.target_type})
                      </span>
                      <p className="text-slate-400 mt-0.5">
                        بواسطة: {log.actor_email || "النظام"}
                      </p>
                    </div>
                    <span className="text-slate-400">
                      {formatArabicDate(log.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SECURITY */}
        {tab === "security" && (
          <PasswordChangeCard
            mustChangePassword={mustChange}
            onSuccess={() => setMustChange(false)}
          />
        )}
      </main>

      {/* Tenant Modal */}
      {tenantModalOpen && (
        <div
          onClick={() => setTenantModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={saveTenant}
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full rounded-3xl p-6 glass-panel bg-white dark:bg-[#071A38] space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg">
                {editingTenant
                  ? `تعديل هوية: ${editingTenant.name_ar}`
                  : "إضافة جهة جديدة"}
              </h3>
              <button
                type="button"
                onClick={() => setTenantModalOpen(false)}
                className="p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold">المعرف (Slug) *</label>
                <input
                  required
                  dir="ltr"
                  disabled={!!editingTenant}
                  value={tSlug}
                  onChange={(e) => setTSlug(e.target.value)}
                  placeholder="my-cafe"
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15 disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">الاسم بالعربية *</label>
                <input
                  required
                  value={tNameAr}
                  onChange={(e) => setTNameAr(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">الاسم بالإنجليزية</label>
                <input
                  dir="ltr"
                  value={tNameEn}
                  onChange={(e) => setTNameEn(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={tAddress}
                onChange={(e) => setTAddress(e.target.value)}
                placeholder="العنوان"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
              />
              <input
                dir="ltr"
                value={tPhone}
                onChange={(e) => setTPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-white/15"
              />
              <input
                dir="ltr"
                value={tWhatsapp}
                onChange={(e) => setTWhatsapp(e.target.value)}
                placeholder="واتساب (9677...)"
                className="rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-white/15"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-xs font-bold">اللون الأساسي</label>
                <input
                  type="color"
                  value={tPrimaryColor}
                  onChange={(e) => setTPrimaryColor(e.target.value)}
                  className="w-full h-10 rounded-xl cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">اللون المميز</label>
                <input
                  type="color"
                  value={tAccentColor}
                  onChange={(e) => setTAccentColor(e.target.value)}
                  className="w-full h-10 rounded-xl cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">العملة</label>
                <input
                  value={tCurrency}
                  onChange={(e) => setTCurrency(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">إنستغرام</label>
                <input
                  dir="ltr"
                  value={tInstagram}
                  onChange={(e) => setTInstagram(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{tLogoUrl ? "تغيير الشعار ✓" : "رفع شعار الجهة"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const u = await uploadAdminMedia(f, "logo");
                    if (u) setTLogoUrl(u);
                  }}
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{tCoverUrl ? "تغيير الغلاف ✓" : "رفع صورة الغلاف"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const u = await uploadAdminMedia(f, "cover");
                    if (u) setTCoverUrl(u);
                  }}
                />
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold">رسالة الإيقاف المخصصة</label>
              <input
                value={tSuspendedMsg}
                onChange={(e) => setTSuspendedMsg(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-white/15"
              />
            </div>

            {!editingTenant && (
              <label className="flex items-center gap-2.5 rounded-xl p-3 bg-brand-orange/10 border border-brand-orange/30 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={tSeedDemo}
                  onChange={(e) => setTSeedDemo(e.target.checked)}
                />
                <span>
                  إنشاء منيو تجريبي مبدئي (أقسام وأصناف نموذجية لمعاينة القالب
                  فوراً)
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={savingTenant || uploadingMedia}
              className="w-full rounded-2xl py-3 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow"
            >
              {savingTenant ? "جاري الحفظ..." : "حفظ بيانات الجهة"}
            </button>
          </form>
        </div>
      )}

      {qrTenant && (
        <QrGeneratorModal tenant={qrTenant} onClose={() => setQrTenant(null)} />
      )}
    </div>
  );
}
