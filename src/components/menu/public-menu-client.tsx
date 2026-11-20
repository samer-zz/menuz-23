"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Instagram,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  Copy,
  Check,
  Sparkles,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Truck,
  Store,
  Wallet as WalletIcon,
  Banknote,
  MessageCircle,
  MessageSquareText,
  Lock,
  PauseCircle,
  UtensilsCrossed,
  Flame,
  CupSoda,
  Sandwich,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/providers/theme-provider";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { PwaInstallButton } from "@/components/pwa/install-button";
import {
  buildSmsUrl,
  buildWhatsAppUrl,
  cn,
  formatInvoiceMessage,
  formatPrice,
  isOfferCurrentlyActive,
} from "@/lib/utils";
import type {
  Category,
  MenuBadge,
  MenuItem,
  Offer,
  Tenant,
  Wallet,
} from "@/types/database";

interface CartLine {
  item: MenuItem;
  quantity: number;
}

const BADGE_META: Record<
  MenuBadge,
  { label: string; className: string }
> = {
  best_seller: {
    label: "🔥 الأكثر طلباً",
    className:
      "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  new: {
    label: "🆕 جديد",
    className:
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  limited_offer: {
    label: "⏰ عرض محدود",
    className:
      "bg-brand-orange/20 text-brand-amber border-brand-orange/35",
  },
  unavailable: {
    label: "🚫 غير متوفر",
    className:
      "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
};

function DishArtFallback({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const Icon =
    lower.includes("كركديه") || lower.includes("عصير") || lower.includes("مشروب")
      ? CupSoda
      : lower.includes("سندوتش") || lower.includes("برجر")
        ? Sandwich
        : lower.includes("اندوميتو") || lower.includes("نودلز")
          ? Flame
          : UtensilsCrossed;

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#0B2D5B] via-[#092247] to-[#040E21] flex items-center justify-center relative overflow-hidden">
      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-brand-orange/20 blur-xl" />
      <Icon className="w-9 h-9 text-brand-orange/90 relative z-10" />
    </div>
  );
}

export function PublicMenuClient({
  tenant,
  categories,
  items,
  offers,
  wallets,
}: {
  tenant: Tenant;
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
}) {
  const { theme, toggleTheme, toast } = useApp();
  const [search, setSearch] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<MenuBadge | "all">("all");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [storyOpen, setStoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Checkout state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">(
    tenant.has_delivery ? "delivery" : "pickup"
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    wallets[0]?.id || ""
  );
  const [transactionRef, setTransactionRef] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const activeOffers = useMemo(
    () => offers.filter((o) => isOfferCurrentlyActive(o)),
    [offers]
  );

  // Record 1 menu_scan per browser session for accurate analytics
  useEffect(() => {
    if (!tenant.is_active) return;
    const key = `menuz-scanned-${tenant.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const supabase = createClient();
    supabase
      .rpc("record_menu_event", {
        p_tenant_id: tenant.id,
        p_event_type: "menu_scan",
      })
      .then(() => {});
  }, [tenant.id, tenant.is_active]);

  // Load persisted cart for this tenant
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`menuz-cart-${tenant.slug}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; quantity: number }>;
        const restored: CartLine[] = [];
        for (const row of parsed) {
          const found = items.find((i) => i.id === row.id && i.is_available);
          if (found && row.quantity > 0) {
            restored.push({ item: found, quantity: row.quantity });
          }
        }
        setCart(restored);
      }
    } catch {
      // ignore storage errors
    }
  }, [tenant.slug, items]);

  useEffect(() => {
    try {
      const compact = cart.map((c) => ({ id: c.item.id, quantity: c.quantity }));
      localStorage.setItem(`menuz-cart-${tenant.slug}`, JSON.stringify(compact));
    } catch {
      // ignore
    }
  }, [cart, tenant.slug]);

  const featuredItems = useMemo(
    () => items.filter((i) => i.is_featured && i.is_available),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.ingredients || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q);
      const matchBadge =
        badgeFilter === "all" || item.badges.includes(badgeFilter);
      return matchSearch && matchBadge;
    });
  }, [items, search, badgeFilter]);

  const cartCount = useMemo(
    () => cart.reduce((acc, c) => acc + c.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((acc, c) => acc + Number(c.item.price) * c.quantity, 0),
    [cart]
  );

  const getQty = (id: string) =>
    cart.find((c) => c.item.id === id)?.quantity || 0;

  const addToCart = (item: MenuItem) => {
    if (!item.is_available || item.badges.includes("unavailable")) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast(`تمت إضافة «${item.name}» إلى السلة`, "success");
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    const supabase = createClient();
    supabase
      .rpc("record_menu_event", {
        p_tenant_id: tenant.id,
        p_event_type: "item_view",
        p_item_id: item.id,
      })
      .then(() => {});
  };

  const copyText = async (text: string, id: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast(`تم نسخ ${label}: ${text}`, "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("تعذر النسخ التلقائي", "error");
    }
  };

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    const el = document.getElementById(`cat-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const selectedWallet =
    wallets.find((w) => w.id === selectedWalletId) || wallets[0];

  const invoiceMessage = useMemo(() => {
    return formatInvoiceMessage({
      tenantName: tenant.name_ar,
      currency: tenant.currency || "ر.ي",
      items: cart.map((c) => ({
        name: c.item.name,
        quantity: c.quantity,
        price: Number(c.item.price),
      })),
      total: cartTotal,
      customerName: customerName || "عميل",
      customerPhone: customerPhone || "-",
      orderType,
      deliveryAddress: deliveryAddress || undefined,
      paymentMethod,
      walletName: selectedWallet?.name,
      walletAccount: selectedWallet?.account_number,
      transactionRef: transactionRef || undefined,
      notes: orderNotes || undefined,
    });
  }, [
    tenant.name_ar,
    tenant.currency,
    cart,
    cartTotal,
    customerName,
    customerPhone,
    orderType,
    deliveryAddress,
    paymentMethod,
    selectedWallet,
    transactionRef,
    orderNotes,
  ]);

  const validateCheckout = (): boolean => {
    if (!customerName.trim()) {
      toast("يرجى كتابة اسمك لإتمام الطلب", "error");
      return false;
    }
    if (!customerPhone.trim()) {
      toast("يرجى كتابة رقم الجوال للتواصل", "error");
      return false;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast("يرجى إدخال عنوان التوصيل", "error");
      return false;
    }
    if (paymentMethod === "wallet" && !transactionRef.trim()) {
      toast("يرجى إدخال رقم عملية التحويل للمحفظة الإلكترونية", "error");
      return false;
    }
    return true;
  };

  const handleSendOrder = (channel: "whatsapp" | "sms") => {
    if (!validateCheckout()) return;

    const supabase = createClient();
    supabase
      .rpc("record_menu_event", {
        p_tenant_id: tenant.id,
        p_event_type: "order_submit",
        p_metadata: {
          channel,
          total: cartTotal,
          items_count: cartCount,
          payment_method: paymentMethod,
        },
      })
      .then(() => {});

    const url =
      channel === "whatsapp"
        ? buildWhatsAppUrl(tenant.whatsapp || tenant.phone, invoiceMessage)
        : buildSmsUrl(tenant.phone, invoiceMessage);

    window.open(url, "_blank", "noopener,noreferrer");
    toast("تم تجهيز الفاتورة وفتح التطبيق للإرسال!", "success");
  };

  // SUSPENDED TENANT SCREEN
  if (!tenant.is_active) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 menuz-grid-bg">
        <div className="max-w-md w-full rounded-3xl p-8 text-center space-y-6 glass-panel">
          <div className="flex items-center justify-between">
            <MenuzLogo height={36} />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-navy-700/15 dark:border-white/15"
              aria-label="تبديل المظهر"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-brand-amber" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>

          {tenant.logo_url && (
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-brand-orange/40 shadow-xl">
              <Image
                src={tenant.logo_url}
                alt={tenant.name_ar}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
              <PauseCircle className="w-4 h-4" />
              <span>المنيو متوقف مؤقتاً</span>
            </div>
            <h1 className="text-2xl font-black">{tenant.name_ar}</h1>
            <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
              {tenant.suspended_message}
            </p>
          </div>

          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
            >
              <Phone className="w-4 h-4" />
              <span>تواصل مع المطعم: {tenant.phone}</span>
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-28">
      {/* HERO / COVER HEADER */}
      <header className="relative overflow-hidden border-b border-navy-700/10 dark:border-white/10">
        {/* Background Cover or Brand Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: tenant.cover_url
              ? undefined
              : `radial-gradient(circle at top right, ${
                  tenant.accent_color || "#FF7A00"
                }33, transparent 55%), linear-gradient(135deg, ${
                  tenant.primary_color || "#0B2D5B"
                } 0%, #040E21 100%)`,
          }}
        >
          {tenant.cover_url && (
            <>
              <Image
                src={tenant.cover_url}
                alt={tenant.name_ar}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040E21] via-[#040E21]/75 to-[#040E21]/40" />
            </>
          )}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-8 text-white space-y-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/15 transition"
            >
              <MenuzLogo forceTheme="dark" height={28} />
            </Link>

            <div className="flex items-center gap-2">
              <PwaInstallButton
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              />
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 transition"
                aria-label="تبديل الوضع الليلي"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-brand-amber" />
                ) : (
                  <Moon className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Tenant Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-brand-orange/60 bg-[#040E21] shadow-2xl shrink-0">
              {tenant.logo_url ? (
                <Image
                  src={tenant.logo_url}
                  alt={tenant.name_ar}
                  width={112}
                  height={112}
                  priority
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-brand-orange">
                  {tenant.name_ar.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-3xl sm:text-4xl font-black">
                  {tenant.name_ar}
                </h1>
                {tenant.name_en && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-white/10 border border-white/15 text-brand-amber">
                    {tenant.name_en}
                  </span>
                )}
              </div>

              {tenant.description && (
                <p className="text-sm text-slate-200 max-w-2xl leading-relaxed">
                  {tenant.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200 pt-1">
                {tenant.address && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                    <span>{tenant.address}</span>
                  </span>
                )}
                {tenant.has_delivery && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-semibold">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{tenant.delivery_note || "خدمة التوصيل متوفرة"}</span>
                  </span>
                )}
                {tenant.story && (
                  <button
                    type="button"
                    onClick={() => setStoryOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-orange/25 border border-brand-orange/40 text-brand-amber font-bold hover:bg-brand-orange/35 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>قصتنا</span>
                    {storyOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Story */}
          <AnimatePresence>
            {storyOpen && tenant.story && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl p-4 bg-white/10 backdrop-blur-md border border-white/15 text-sm leading-relaxed text-slate-100">
                  {tenant.story}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ANIMATED OFFERS MARQUEE */}
      {activeOffers.length > 0 && (
        <div className="bg-orange-gradient text-white py-2.5 overflow-hidden border-b border-white/15 shadow-lg">
          <div className="flex w-max animate-marquee-rtl gap-10 px-4">
            {[...activeOffers, ...activeOffers].map((offer, i) => (
              <div
                key={`${offer.id}-${i}`}
                className="inline-flex items-center gap-2.5 text-sm font-bold shrink-0"
              >
                <span className="px-2.5 py-0.5 rounded-full bg-navy-900/40 text-xs">
                  {offer.badge_text}
                </span>
                <span>{offer.title}</span>
                {offer.discount_text && (
                  <span className="px-2 py-0.5 rounded-md bg-white text-brand-ember text-xs font-black">
                    {offer.discount_text}
                  </span>
                )}
                {offer.description && (
                  <span className="text-white/90 font-normal text-xs">
                    — {offer.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEATURED CAROUSEL */}
      {featuredItems.length > 0 && (
        <section className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg sm:text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-orange" />
              <span>الأصناف المميزة</span>
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x">
            {featuredItems.map((item) => {
              const qty = getQty(item.id);
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -3 }}
                  className="snap-start shrink-0 w-64 rounded-2xl overflow-hidden glass-card border border-brand-orange/25 flex flex-col"
                >
                  <div
                    onClick={() => openItemDetail(item)}
                    className="h-32 w-full relative cursor-pointer"
                  >
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        loading="lazy"
                        className="object-cover"
                      />
                    ) : (
                      <DishArtFallback name={item.name} />
                    )}
                    <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-navy-900/80 text-brand-amber backdrop-blur-md">
                      ⭐ مميز
                    </span>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div
                      onClick={() => openItemDetail(item)}
                      className="cursor-pointer"
                    >
                      <h3 className="font-extrabold text-sm line-clamp-1">
                        {item.name}
                      </h3>
                      {item.ingredients && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {item.ingredients}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-brand-orange text-sm">
                        {formatPrice(item.price, tenant.currency)}
                      </span>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>أضف</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-xl px-2 py-1 bg-brand-orange/15 border border-brand-orange/30">
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            className="p-0.5 text-brand-orange"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black min-w-[16px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            className="p-0.5 text-brand-orange"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* STICKY CATEGORIES + SEARCH BAR */}
      <div className="sticky top-0 z-30 mt-5 bg-white/85 dark:bg-[#040E21]/85 backdrop-blur-xl border-y border-navy-700/10 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Categories Strip */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all",
                      active
                        ? "bg-orange-gradient text-white shadow-orange-glow"
                        : "bg-slate-100 dark:bg-navy-800/80 text-navy-700 dark:text-slate-300 hover:border-brand-orange/50 border border-transparent"
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search & Badge Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صنف أو مكوّن..."
                className="w-full rounded-xl pr-10 pl-4 py-2.5 text-sm bg-slate-100/90 dark:bg-navy-800/80 border border-navy-700/10 dark:border-white/10 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { key: "all", label: "الكل" },
                  { key: "best_seller", label: "🔥 الأكثر طلباً" },
                  { key: "new", label: "🆕 جديد" },
                  { key: "limited_offer", label: "⏰ عرض محدود" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setBadgeFilter(chip.key)}
                  className={cn(
                    "shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition",
                    badgeFilter === chip.key
                      ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                      : "bg-slate-100/80 dark:bg-navy-800/60 border-navy-700/10 dark:border-white/10 text-slate-500 dark:text-slate-300"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MENU CATEGORIES & ITEMS */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {categories.length === 0 ? (
          <div className="rounded-3xl p-12 text-center glass-panel space-y-2">
            <UtensilsCrossed className="w-10 h-10 text-brand-orange mx-auto" />
            <h2 className="text-xl font-extrabold">القائمة قيد التحديث</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              لم تتم إضافة أصناف في هذا المنيو بعد.
            </p>
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = filteredItems.filter(
              (i) => i.category_id === cat.id
            );
            if (catItems.length === 0) return null;

            return (
              <section
                key={cat.id}
                id={`cat-${cat.id}`}
                className="scroll-mt-36 space-y-4"
              >
                <div className="flex items-baseline justify-between border-b border-navy-700/10 dark:border-white/10 pb-2.5">
                  <div>
                    <h2 className="font-display text-2xl font-black">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-orange/15 text-brand-orange">
                    {catItems.length} أصناف
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catItems.map((item) => {
                    const unavailable =
                      !item.is_available || item.badges.includes("unavailable");
                    const qty = getQty(item.id);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-30px" }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          "group rounded-2xl p-3.5 glass-card flex gap-3.5 items-stretch",
                          unavailable
                            ? "opacity-65 grayscale-[40%]"
                            : "hover:border-brand-orange/45"
                        )}
                      >
                        {/* Thumbnail */}
                        <div
                          onClick={() => openItemDetail(item)}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 relative cursor-pointer"
                        >
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              loading="lazy"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <DishArtFallback name={item.name} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                          <div
                            onClick={() => openItemDetail(item)}
                            className="cursor-pointer space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {unavailable && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-500/15 text-rose-400 border-rose-500/30">
                                  🚫 غير متوفر
                                </span>
                              )}
                              {item.badges
                                .filter((b) => b !== "unavailable")
                                .map((b) => (
                                  <span
                                    key={b}
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                      BADGE_META[b]?.className
                                    )}
                                  >
                                    {BADGE_META[b]?.label || b}
                                  </span>
                                ))}
                            </div>

                            <h3 className="font-extrabold text-base leading-snug">
                              {item.name}
                            </h3>

                            {(item.ingredients || item.description) && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {item.ingredients || item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-black text-base text-brand-orange">
                                {formatPrice(item.price, tenant.currency)}
                              </span>
                              {item.original_price &&
                                item.original_price > item.price && (
                                  <span className="text-xs line-through text-slate-400">
                                    {formatPrice(
                                      item.original_price,
                                      tenant.currency
                                    )}
                                  </span>
                                )}
                            </div>

                            {!unavailable &&
                              (qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>أضف للسلة</span>
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 bg-brand-orange/15 border border-brand-orange/35">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="p-0.5 text-brand-orange hover:scale-110 transition"
                                    aria-label="إنقاص الكمية"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="text-sm font-black min-w-[18px] text-center">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, 1)}
                                    className="p-0.5 text-brand-orange hover:scale-110 transition"
                                    aria-label="زيادة الكمية"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        {filteredItems.length === 0 && items.length > 0 && (
          <div className="rounded-3xl p-10 text-center glass-panel space-y-2">
            <Search className="w-8 h-8 text-brand-orange mx-auto" />
            <p className="font-bold">لا توجد نتائج مطابقة لبحثك</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setBadgeFilter("all");
              }}
              className="text-xs font-bold text-brand-orange underline"
            >
              إعادة ضبط الفلترة
            </button>
          </div>
        )}
      </main>

      {/* CREATIVE TENANT FOOTER */}
      <footer className="border-t border-navy-700/10 dark:border-white/10 bg-slate-100/80 dark:bg-[#030B1A] mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {/* Electronic Wallets Strip */}
          {wallets.length > 0 && (
            <div className="rounded-3xl p-6 glass-panel space-y-4">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-brand-orange" />
                <h3 className="font-extrabold text-base">
                  المحافظ الإلكترونية المتاحة للدفع
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3.5 bg-slate-100/80 dark:bg-navy-900/80 border border-navy-700/10 dark:border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {w.logo_url ? (
                        <Image
                          src={w.logo_url}
                          alt={w.name}
                          width={36}
                          height={36}
                          className="rounded-xl object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-brand-orange/15 text-brand-orange flex items-center justify-center shrink-0">
                          <WalletIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{w.name}</p>
                        <p
                          dir="ltr"
                          className="text-xs font-mono text-brand-orange truncate"
                        >
                          {w.account_number}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(w.account_number, w.id, `رقم محفظة ${w.name}`)
                      }
                      className="p-2 rounded-xl bg-brand-orange/15 text-brand-orange hover:bg-brand-orange hover:text-white transition shrink-0"
                      title="نسخ رقم المحفظة"
                    >
                      {copiedId === w.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              {tenant.logo_url && (
                <Image
                  src={tenant.logo_url}
                  alt={tenant.name_ar}
                  width={52}
                  height={52}
                  className="rounded-2xl object-cover border border-brand-orange/30"
                />
              )}
              <div>
                <h4 className="font-black text-lg">{tenant.name_ar}</h4>
                {tenant.address && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tenant.address}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {tenant.phone && (
                <a
                  href={`tel:${tenant.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold glass-panel hover:border-brand-orange/50"
                >
                  <Phone className="w-3.5 h-3.5 text-brand-orange" />
                  <span dir="ltr">{tenant.phone}</span>
                </a>
              )}
              {tenant.instagram && (
                <a
                  href={`https://instagram.com/${tenant.instagram.replace(
                    "@",
                    ""
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold glass-panel hover:border-brand-orange/50"
                >
                  <Instagram className="w-3.5 h-3.5 text-brand-orange" />
                  <span dir="ltr">@{tenant.instagram.replace("@", "")}</span>
                </a>
              )}
              <PwaInstallButton variant="outline" />
            </div>
          </div>

          <div className="pt-5 border-t border-navy-700/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>مدعوم بواسطة</span>
              <Link href="/" className="font-bold text-brand-orange hover:underline">
                مينوز | MENUZ
              </Link>
              <span>• شركة سامرز للحلول الذكية</span>
            </div>

            {/* Discreet Admin Access Link */}
            <Link
              href="/login"
              className="inline-flex items-center gap-1 opacity-60 hover:opacity-100 hover:text-brand-orange transition"
              title="دخول لوحة الإدارة"
            >
              <Lock className="w-3 h-3" />
              <span>الإدارة</span>
            </Link>
          </div>
        </div>
      </footer>

      {/* FLOATING LIVE CART BAR */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 inset-x-4 z-40 max-w-xl mx-auto"
          >
            <button
              type="button"
              onClick={() => {
                setInvoiceStep(false);
                setCartOpen(true);
              }}
              className="w-full rounded-2xl px-5 py-4 bg-orange-gradient text-white shadow-2xl shadow-brand-orange/40 flex items-center justify-between gap-4 hover:brightness-110 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm">
                  {cartCount}
                </span>
                <div className="text-right">
                  <p className="font-extrabold text-sm">عرض سلة الطلبات</p>
                  <p className="text-[11px] text-white/85">
                    اضغط لمراجعة الفاتورة وإرسال الطلب
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-black text-base">
                <span>{formatPrice(cartTotal, tenant.currency)}</span>
                <ShoppingBag className="w-5 h-5" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ITEM DETAIL MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedItem(null)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden glass-panel bg-white dark:bg-[#071A38] shadow-2xl"
            >
              <div className="relative h-56 w-full">
                {selectedItem.image_url ? (
                  <Image
                    src={selectedItem.image_url}
                    alt={selectedItem.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <DishArtFallback name={selectedItem.name} />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">{selectedItem.name}</h3>
                    {selectedItem.ingredients && (
                      <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                        {selectedItem.ingredients}
                      </p>
                    )}
                  </div>
                  <span className="text-xl font-black text-brand-orange shrink-0">
                    {formatPrice(selectedItem.price, tenant.currency)}
                  </span>
                </div>
                {selectedItem.description && (
                  <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                    {selectedItem.description}
                  </p>
                )}

                {selectedItem.is_available &&
                !selectedItem.badges.includes("unavailable") ? (
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="w-full rounded-2xl py-3.5 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow"
                  >
                    أضف للسلة —{" "}
                    {formatPrice(selectedItem.price, tenant.currency)}
                  </button>
                ) : (
                  <div className="rounded-2xl py-3 text-center text-sm font-bold bg-rose-500/15 text-rose-400">
                    🚫 هذا الصنف غير متوفر حالياً
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-OVER CART & INVOICE DRAWER */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full bg-white dark:bg-[#040E21] border-r border-navy-700/15 dark:border-white/10 flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-navy-700/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-brand-orange" />
                  <h2 className="text-lg font-black">
                    {invoiceStep ? "مراجعة الفاتورة وإرسال الطلب" : "سلة الطلبات"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {cart.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="font-bold text-slate-500">
                      سلتك فارغة حالياً
                    </p>
                  </div>
                ) : !invoiceStep ? (
                  <>
                    <div className="space-y-3">
                      {cart.map((line) => (
                        <div
                          key={line.item.id}
                          className="rounded-2xl p-3.5 glass-card flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">
                              {line.item.name}
                            </p>
                            <p className="text-xs text-brand-orange font-bold mt-0.5">
                              {formatPrice(
                                Number(line.item.price) * line.quantity,
                                tenant.currency
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQty(line.item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-sm w-5 text-center">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(line.item.id, 1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCart((p) =>
                                  p.filter((x) => x.item.id !== line.item.id)
                                )
                              }
                              className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl p-4 bg-slate-100/80 dark:bg-navy-800/60 flex items-center justify-between">
                      <span className="font-bold text-sm">الإجمالي</span>
                      <span className="font-black text-xl text-brand-orange">
                        {formatPrice(cartTotal, tenant.currency)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Editable Items Summary */}
                    <div className="rounded-2xl p-3.5 bg-slate-100/80 dark:bg-navy-800/60 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span>الأصناف المختارة ({cartCount})</span>
                        <button
                          type="button"
                          onClick={() => setInvoiceStep(false)}
                          className="text-brand-orange hover:underline"
                        >
                          تعديل الأصناف
                        </button>
                      </div>
                      {cart.map((c) => (
                        <div
                          key={c.item.id}
                          className="flex justify-between text-xs font-semibold"
                        >
                          <span>
                            {c.item.name} × {c.quantity}
                          </span>
                          <span>
                            {formatPrice(
                              Number(c.item.price) * c.quantity,
                              tenant.currency
                            )}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-navy-700/10 dark:border-white/10 flex justify-between font-black text-sm">
                        <span>الإجمالي النهائي</span>
                        <span className="text-brand-orange">
                          {formatPrice(cartTotal, tenant.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Customer Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">الاسم *</label>
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="اسمك الكريم"
                          className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-800 border border-navy-700/15 dark:border-white/15"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رقم الجوال *</label>
                        <input
                          dir="ltr"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="7xxxxxxx"
                          className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-800 border border-navy-700/15 dark:border-white/15"
                        />
                      </div>
                    </div>

                    {/* Order Type */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {tenant.has_delivery && (
                        <button
                          type="button"
                          onClick={() => setOrderType("delivery")}
                          className={cn(
                            "rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5",
                            orderType === "delivery"
                              ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                              : "border-navy-700/15 dark:border-white/15"
                          )}
                        >
                          <Truck className="w-4 h-4" />
                          <span>توصيل للموقع</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOrderType("pickup")}
                        className={cn(
                          "rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5",
                          orderType === "pickup"
                            ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                            : "border-navy-700/15 dark:border-white/15",
                          !tenant.has_delivery && "col-span-2"
                        )}
                      >
                        <Store className="w-4 h-4" />
                        <span>استلام من الفرع</span>
                      </button>
                    </div>

                    {orderType === "delivery" && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold">
                          عنوان التوصيل بالتفصيل *
                        </label>
                        <input
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="الحي، الشارع، أقرب معلم..."
                          className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-800 border border-navy-700/15 dark:border-white/15"
                        />
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold block">
                        طريقة الدفع
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={cn(
                            "rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5",
                            paymentMethod === "cash"
                              ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                              : "border-navy-700/15 dark:border-white/15"
                          )}
                        >
                          <Banknote className="w-4 h-4" />
                          <span>نقداً عند الاستلام</span>
                        </button>

                        <button
                          type="button"
                          disabled={wallets.length === 0}
                          onClick={() => setPaymentMethod("wallet")}
                          className={cn(
                            "rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 disabled:opacity-45",
                            paymentMethod === "wallet"
                              ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                              : "border-navy-700/15 dark:border-white/15"
                          )}
                        >
                          <WalletIcon className="w-4 h-4" />
                          <span>محفظة إلكترونية</span>
                        </button>
                      </div>

                      {paymentMethod === "wallet" && wallets.length > 0 && (
                        <div className="rounded-2xl p-3.5 bg-slate-100 dark:bg-navy-800/80 border border-brand-orange/30 space-y-3">
                          <div className="space-y-2">
                            {wallets.map((w) => (
                              <div
                                key={w.id}
                                onClick={() => setSelectedWalletId(w.id)}
                                className={cn(
                                  "cursor-pointer rounded-xl p-2.5 border flex items-center justify-between gap-2 transition",
                                  selectedWallet?.id === w.id
                                    ? "border-brand-orange bg-brand-orange/10"
                                    : "border-navy-700/10 dark:border-white/10"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {w.logo_url ? (
                                    <Image
                                      src={w.logo_url}
                                      alt={w.name}
                                      width={28}
                                      height={28}
                                      className="rounded-lg object-contain"
                                    />
                                  ) : (
                                    <WalletIcon className="w-4 h-4 text-brand-orange shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">
                                      {w.name}
                                      {w.account_name
                                        ? ` (${w.account_name})`
                                        : ""}
                                    </p>
                                    <p
                                      dir="ltr"
                                      className="text-xs font-mono text-brand-orange"
                                    >
                                      {w.account_number}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyText(
                                      w.account_number,
                                      `drawer-${w.id}`,
                                      w.name
                                    );
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-brand-orange/20 text-brand-orange text-[11px] font-bold"
                                >
                                  نسخ
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold">
                              رقم العملية / المرجع *
                            </label>
                            <input
                              dir="ltr"
                              value={transactionRef}
                              onChange={(e) => setTransactionRef(e.target.value)}
                              placeholder="أدخل رقم إشعار التحويل"
                              className="w-full rounded-xl px-3 py-2 text-sm text-right bg-white dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold">
                        ملاحظات إضافية (اختياري)
                      </label>
                      <input
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="بدون شطة، زيادة جبن..."
                        className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-800 border border-navy-700/15 dark:border-white/15"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-navy-700/10 dark:border-white/10 space-y-2.5">
                  {!invoiceStep ? (
                    <button
                      type="button"
                      onClick={() => setInvoiceStep(true)}
                      className="w-full rounded-2xl py-3.5 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
                    >
                      متابعة وإصدار الفاتورة (
                      {formatPrice(cartTotal, tenant.currency)})
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendOrder("whatsapp")}
                        className="w-full rounded-2xl py-3.5 text-sm font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>إرسال الفاتورة عبر واتساب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOrder("sms")}
                        className="w-full rounded-2xl py-3 text-xs font-bold border border-navy-700/20 dark:border-white/15 flex items-center justify-center gap-2 hover:border-brand-orange/60 transition"
                      >
                        <MessageSquareText className="w-4 h-4 text-brand-orange" />
                        <span>إرسال عبر رسالة نصية (SMS)</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
