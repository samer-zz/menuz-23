"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Bell,
  BellRing,
  LayoutGrid,
  List,
  BookOpen,
  Home,
  FlaskConical,
  WifiOff,
  RefreshCw,
  RotateCcw,
  Share2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/providers/theme-provider";
import { MenuzLogo, SamerzLogo } from "@/components/ui/brand-logo";
import { PwaInstallButton, PwaOnboardingHint } from "@/components/pwa/install-button";
import { EmptyStateCard } from "@/components/ui/skeletons";
import {
  ThankYouFeedbackModal,
  type CompletedOrderSummary,
} from "@/components/menu/thank-you-feedback-modal";
import {
  resolveTenantTheme,
  type ResolvedTenantTheme,
} from "@/lib/theme-colors";
import {
  buildSmsUrl,
  buildWhatsAppUrl,
  cn,
  formatArabicDate,
  formatPrice,
  isOfferCurrentlyActive,
  normalizePhoneForWhatsApp,
} from "@/lib/utils";
import type {
  Category,
  MenuBadge,
  MenuItem,
  Offer,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

interface CartLine {
  item: MenuItem;
  quantity: number;
}

interface StoredLastOrder {
  savedAt: number;
  lines: Array<{ id: string; quantity: number }>;
}

type ViewMode = "cards" | "list" | "classic";

const LAST_ORDER_TTL_MS = 15 * 60 * 1000;

const BADGE_META: Record<MenuBadge, { label: string; className: string }> = {
  best_seller: {
    label: "🔥 الأكثر طلباً",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  new: {
    label: "🆕 جديد",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  limited_offer: {
    label: "⏰ عرض محدود",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/35",
  },
  unavailable: {
    label: "🚫 غير متوفر",
    className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
};

function sanitizeExternalSocialUrl(
  platform: "instagram" | "facebook" | "tiktok",
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;

  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    try {
      const u = new URL(trimmed);
      if (u.protocol === "https:" || u.protocol === "http:") return trimmed;
      return null;
    } catch {
      return null;
    }
  }

  const handle = trimmed.replace(/^@+/, "");
  if (!handle) return null;
  if (platform === "instagram") return `https://instagram.com/${encodeURIComponent(handle)}`;
  if (platform === "facebook") return `https://facebook.com/${encodeURIComponent(handle)}`;
  return `https://tiktok.com/@${encodeURIComponent(handle)}`;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function DishArtFallback({
  name,
  themeColors,
  compact = false,
}: {
  name: string;
  themeColors: ResolvedTenantTheme;
  compact?: boolean;
}) {
  const lower = name.toLowerCase();
  const Icon =
    lower.includes("كركديه") ||
    lower.includes("عصير") ||
    lower.includes("مشروب")
      ? CupSoda
      : lower.includes("سندوتش") || lower.includes("برجر")
        ? Sandwich
        : lower.includes("اندوميتو") || lower.includes("نودلز")
          ? Flame
          : UtensilsCrossed;

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.background} 100%)`,
      }}
    >
      <div
        className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-xl opacity-30"
        style={{ backgroundColor: themeColors.accent }}
      />
      <Icon
        className={cn(
          "relative z-10 drop-shadow",
          compact ? "w-6 h-6" : "w-9 h-9"
        )}
        style={{ color: themeColors.accent }}
      />
    </div>
  );
}

function TenantSocialIcons({
  tenant,
  themeColors,
  inHeader = false,
}: {
  tenant: Tenant;
  themeColors: ResolvedTenantTheme;
  inHeader?: boolean;
}) {
  const whatsappDigits = normalizePhoneForWhatsApp(tenant.whatsapp || tenant.phone);
  const instagramUrl = sanitizeExternalSocialUrl("instagram", tenant.instagram);
  const facebookUrl = sanitizeExternalSocialUrl("facebook", tenant.facebook);
  const tiktokUrl = sanitizeExternalSocialUrl("tiktok", tenant.tiktok);

  const links: Array<{
    key: string;
    href: string;
    label: string;
    text: string;
    external?: boolean;
  }> = [];

  if (tenant.phone) {
    links.push({
      key: "phone",
      href: `tel:${tenant.phone.trim()}`,
      label: "اتصال هاتفي",
      text: "اتصال",
    });
  }
  if (whatsappDigits) {
    links.push({
      key: "whatsapp",
      href: `https://wa.me/${whatsappDigits}`,
      label: "واتساب",
      text: "واتساب",
      external: true,
    });
  }
  if (instagramUrl) {
    links.push({
      key: "instagram",
      href: instagramUrl,
      label: "إنستغرام",
      text: "إنستغرام",
      external: true,
    });
  }
  if (facebookUrl) {
    links.push({
      key: "facebook",
      href: facebookUrl,
      label: "فيسبوك",
      text: "فيسبوك",
      external: true,
    });
  }
  if (tiktokUrl) {
    links.push({
      key: "tiktok",
      href: tiktokUrl,
      label: "تيك توك",
      text: "تيك توك",
      external: true,
    });
  }

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
          aria-label={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:scale-[1.03]",
            inHeader
              ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
              : "border"
          )}
          style={
            inHeader
              ? undefined
              : {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                }
          }
        >
          {item.key === "phone" && <Phone className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />}
          {item.key === "whatsapp" && <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}
          {item.key === "instagram" && <Instagram className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />}
          {(item.key === "facebook" || item.key === "tiktok") && (
            <Share2 className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />
          )}
          <span>{item.text}</span>
        </a>
      ))}
    </div>
  );
}

export function PublicMenuClient({
  tenant,
  categories,
  items,
  offers,
  wallets,
  initialNotifications = [],
}: {
  tenant: Tenant;
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
  initialNotifications?: TenantNotification[];
}) {
  const { theme, toggleTheme, toast } = useApp();
  const themeColors = useMemo(
    () => resolveTenantTheme(tenant, theme),
    [tenant, theme]
  );

  const [search, setSearch] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<MenuBadge | "all">("all");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showSplash, setShowSplash] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Featured carousel auto-scroll pause state
  const featuredStripRef = useRef<HTMLDivElement | null>(null);
  const [featuredPaused, setFeaturedPaused] = useState(false);

  // Notifications & Web Push state
  const [notifications, setNotifications] = useState<TenantNotification[]>(
    initialNotifications
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialNotifications.length);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);

  const [storyOpen, setStoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Checkout state (Name & Phone are OPTIONAL per spec)
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
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());
  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrderSummary | null>(null);
  const [restorableOrder, setRestorableOrder] = useState<StoredLastOrder | null>(
    null
  );

  const activeOffers = useMemo(
    () => offers.filter((o) => isOfferCurrentlyActive(o)),
    [offers]
  );

  // 1. Dynamic PWA manifest link sync for client-side navigations
  useEffect(() => {
    const manifestHref = `/api/manifest/${tenant.slug}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = manifestHref;
  }, [tenant.slug]);

  // 2. Network status, reduced-motion, and Web Push support detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!window.navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      toast("عاد الاتصال بالإنترنت — يمكنك تحديث المنيو", "info");
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onMq);

    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushSubscribed(Boolean(sub)))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      mq.removeEventListener?.("change", onMq);
    };
  }, [toast]);

  // 3. Smooth 3.2s skippable welcome splash (once per session, respects reduced-motion)
  useEffect(() => {
    if (reducedMotion) return;
    const key = `menuz-splash-v4-${tenant.slug}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setShowSplash(true);
        const timer = setTimeout(() => setShowSplash(false), 3200);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore sessionStorage errors
    }
  }, [tenant.slug, reducedMotion]);

  // 4. Load & persist ViewMode in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("menuz-view-mode") as ViewMode | null;
      if (saved === "cards" || saved === "list" || saved === "classic") {
        setViewMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("menuz-view-mode", mode);
    } catch {
      // ignore
    }
  };

  // 5. Record 1 menu_scan per browser session
  useEffect(() => {
    if (!tenant.is_active) return;
    try {
      const key = `menuz-scanned-${tenant.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }

    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        eventType: "menu_scan",
      }),
    }).catch(() => {});
  }, [tenant.id, tenant.is_active]);

  // 6. Subscribe to Supabase Realtime for In-App Notifications
  useEffect(() => {
    if (!tenant.is_active) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const incoming = payload.new as TenantNotification;
          if (new Date(incoming.expires_at).getTime() <= Date.now()) return;
          if (
            incoming.scheduled_for &&
            new Date(incoming.scheduled_for).getTime() > Date.now()
          ) {
            return;
          }
          setNotifications((prev) => [incoming, ...prev]);
          setUnreadCount((c) => c + 1);
          toast(`🔔 ${incoming.title}: ${incoming.body}`, "info");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant.id, tenant.is_active, toast]);

  // 7. Load & persist cart + check recent restorable order
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

      const lastRaw = localStorage.getItem(`menuz-last-order-${tenant.slug}`);
      if (lastRaw) {
        const parsedLast = JSON.parse(lastRaw) as StoredLastOrder;
        if (
          parsedLast?.savedAt &&
          Date.now() - parsedLast.savedAt < LAST_ORDER_TTL_MS &&
          Array.isArray(parsedLast.lines) &&
          parsedLast.lines.length > 0
        ) {
          setRestorableOrder(parsedLast);
        } else {
          localStorage.removeItem(`menuz-last-order-${tenant.slug}`);
        }
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

  // 8. Smooth auto-scrolling featured strip (pauses on user interaction & reduced-motion)
  useEffect(() => {
    if (reducedMotion || featuredPaused || featuredItems.length < 2) return;
    const el = featuredStripRef.current;
    if (!el) return;

    const timer = setInterval(() => {
      if (!featuredStripRef.current) return;
      const node = featuredStripRef.current;
      const maxScroll = node.scrollWidth - node.clientWidth;
      if (maxScroll <= 10) return;
      // In RTL, scrollLeft is often <= 0 or moves inversely across browsers; step gently and wrap cleanly
      const next = Math.abs(node.scrollLeft) + 260;
      if (next >= maxScroll) {
        node.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        const dir = getComputedStyle(node).direction === "rtl" ? -1 : 1;
        node.scrollBy({ left: dir * 260, behavior: "smooth" });
      }
    }, 3400);

    return () => clearInterval(timer);
  }, [reducedMotion, featuredPaused, featuredItems.length]);

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

  const addToCart = useCallback(
    (item: MenuItem) => {
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
      toast(`تمت إضافة «${item.name}» للسلة`, "success");
    },
    [toast]
  );

  const updateQty = useCallback((itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setIdempotencyKey(makeIdempotencyKey());
    toast("تم إفراغ السلة", "info");
  }, [toast]);

  const restoreLastOrder = useCallback(() => {
    if (!restorableOrder) return;
    const restored: CartLine[] = [];
    for (const row of restorableOrder.lines) {
      const found = items.find((i) => i.id === row.id && i.is_available);
      if (found && row.quantity > 0) {
        restored.push({ item: found, quantity: row.quantity });
      }
    }
    if (restored.length === 0) {
      toast("أصناف الطلب السابق لم تعد متوفرة", "error");
      return;
    }
    setCart(restored);
    setCompletedOrder(null);
    setInvoiceStep(false);
    setCartOpen(true);
    setIdempotencyKey(makeIdempotencyKey());
    toast("تمت استعادة أصناف طلبك السابق", "success");
  }, [restorableOrder, items, toast]);

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        eventType: "item_view",
        itemId: item.id,
      }),
    }).catch(() => {});
  };

  const copyText = async (text: string, id: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast(`تم نسخ ${label}`, "success");
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

  const handleToggleWebPush = async () => {
    if (!pushSupported || subscribingPush) return;
    setSubscribingPush(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushSubscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: tenant.id, endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setPushSubscribed(false);
        toast("تم إلغاء الاشتراك في إشعارات المتصفح", "info");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast("لم يتم منح صلاحية الإشعارات من المتصفح", "info");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast(
          "تم تفعيل تنبيهات الإشعارات داخل المنيو (مفتاح Web Push الخارجي غير مضاف بعد)",
          "info"
        );
        return;
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: tenant.id,
            subscription: {
              endpoint: json.endpoint,
              keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            },
          }),
        });
        if (res.ok) {
          setPushSubscribed(true);
          toast("تم الاشتراك في إشعارات العروض بنجاح!", "success");
        }
      }
    } catch {
      toast("تعذر تفعيل إشعارات المتصفح على هذا الجهاز", "info");
    } finally {
      setSubscribingPush(false);
    }
  };

  // Validate only required fields (Name & Phone are intentionally OPTIONAL)
  const validateCheckout = (): boolean => {
    if (cart.length === 0) {
      toast("السلة فارغة", "error");
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
    if (
      customerPhone.trim() &&
      !/^[+0-9\s()-]{6,25}$/.test(customerPhone.trim())
    ) {
      toast("يرجى التأكد من صيغة رقم الجوال أو تركه فارغاً", "error");
      return false;
    }
    return true;
  };

  const handleSendOrder = async (channel: "whatsapp" | "sms") => {
    if (submittingOrder) return;
    if (!validateCheckout()) return;

    setSubmittingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          idempotencyKey,
          items: cart.map((c) => ({
            itemId: c.item.id,
            quantity: c.quantity,
          })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          orderType,
          deliveryAddress:
            orderType === "delivery" ? deliveryAddress.trim() : "",
          paymentMethod,
          walletId: paymentMethod === "wallet" ? selectedWallet?.id ?? null : null,
          transactionRef:
            paymentMethod === "wallet" ? transactionRef.trim() : "",
          notes: orderNotes.trim(),
          channel,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        // Never empty cart on failure
        toast(
          payload.error || "تعذر إرسال الطلب الآن، سلتك محفوظة يمكنك المحاولة مجدداً",
          "error"
        );
        return;
      }

      const externalUrl =
        channel === "whatsapp"
          ? buildWhatsAppUrl(tenant.whatsapp || tenant.phone, payload.invoiceMessage)
          : buildSmsUrl(tenant.phone, payload.invoiceMessage);

      // Save temporary backup for restore option before clearing cart
      const backup: StoredLastOrder = {
        savedAt: Date.now(),
        lines: cart.map((c) => ({ id: c.item.id, quantity: c.quantity })),
      };
      try {
        localStorage.setItem(
          `menuz-last-order-${tenant.slug}`,
          JSON.stringify(backup)
        );
      } catch {
        // ignore
      }
      setRestorableOrder(backup);

      // Clear cart ONLY after confirmed server success
      setCart([]);
      setCartOpen(false);
      setInvoiceStep(false);
      setIdempotencyKey(makeIdempotencyKey());

      setCompletedOrder({
        orderId: payload.orderId ?? null,
        orderNumber: payload.orderNumber,
        feedbackToken: payload.feedbackToken,
        items: payload.itemsSnapshot,
        computedTotal: payload.computedTotal,
        currency: payload.currency || tenant.currency || "ر.ي",
        externalUrl,
        channel,
      });

      window.open(externalUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast("تعذر الاتصال بالخادم، سلتك لا تزال محفوظة", "error");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // SUSPENDED TENANT SCREEN
  if (!tenant.is_active) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: themeColors.background, color: themeColors.text }}
      >
        <div
          className="max-w-md w-full rounded-3xl p-8 text-center space-y-6 border shadow-2xl"
          style={{
            backgroundColor: themeColors.card,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex items-center justify-between">
            <MenuzLogo height={36} />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border"
              style={{ borderColor: themeColors.border }}
              aria-label="تبديل المظهر"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" style={{ color: themeColors.accent }} />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>

          {tenant.logo_url && (
            <div
              className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 shadow-xl"
              style={{ borderColor: themeColors.accent }}
            >
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
            <p className="text-sm leading-relaxed" style={{ color: themeColors.mutedText }}>
              {tenant.suspended_message}
            </p>
          </div>

          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-lg"
              style={{
                backgroundColor: themeColors.accent,
                color: themeColors.buttonText,
              }}
            >
              <Phone className="w-4 h-4" />
              <span>تواصل مع المطعم: {tenant.phone}</span>
            </a>
          )}

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
              style={{ color: themeColors.accent }}
            >
              <Home className="w-3.5 h-3.5" />
              <span>الصفحة الرئيسية العامة</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col pb-28 transition-colors duration-300"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.text,
      }}
    >
      {/* SKIPPABLE ELEGANT WELCOME TRANSITION (~3.2s once per session, non-blocking) */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 px-6"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.background} 100%)`,
              color: themeColors.primaryButtonText,
            }}
          >
            <button
              type="button"
              onClick={() => setShowSplash(false)}
              className="absolute top-5 left-5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition"
            >
              تخطي ✕
            </button>

            {tenant.logo_url && (
              <div
                className="w-20 h-20 rounded-3xl overflow-hidden border-2 shadow-2xl"
                style={{ borderColor: themeColors.accent }}
              >
                <Image
                  src={tenant.logo_url}
                  alt={tenant.name_ar}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <MenuzLogo forceTheme="dark" height={44} />

            <div className="text-center space-y-1">
              <p className="text-xs tracking-widest font-bold" style={{ color: themeColors.accent }}>
                أهلاً بكم في
              </p>
              <p className="font-display text-2xl font-black text-white">
                {tenant.name_ar}
              </p>
              <p className="text-xs text-white/75">
                امسح.. اطلب.. واستمتع
              </p>
            </div>

            <div className="w-44 h-1 rounded-full bg-white/15 overflow-hidden">
              <motion.div
                initial={{ width: "10%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="h-full"
                style={{ backgroundColor: themeColors.accent }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OFFLINE STATUS BANNER */}
      {isOffline && (
        <div className="bg-amber-600 text-white py-2 px-4 text-xs font-bold">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                أنت تتصفح نسخة محفوظة دون اتصال — قد لا تعكس الأسعار أو التوفر أحدث تعديل.
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/25 hover:bg-black/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
          </div>
        </div>
      )}

      {/* DEMO MENU BANNER */}
      {tenant.is_demo && (
        <div
          className="text-white border-b py-2 px-4"
          style={{
            backgroundColor: themeColors.primary,
            borderColor: themeColors.border,
          }}
        >
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <FlaskConical className="w-4 h-4 shrink-0" style={{ color: themeColors.accent }} />
              <span>منيو تجريبي تفاعلي (Demo) — استكشف تجربة منصة مينوز</span>
            </div>
            <Link
              href="/contact"
              className="px-3 py-1 rounded-lg font-extrabold transition hover:brightness-110"
              style={{
                backgroundColor: themeColors.accent,
                color: themeColors.buttonText,
              }}
            >
              احصل على منيو مطعمك مجاناً لمدة شهر
            </Link>
          </div>
        </div>
      )}

      {/* HERO / COVER HEADER */}
      <header className="relative overflow-hidden border-b" style={{ borderColor: themeColors.border }}>
        <div
          className="absolute inset-0"
          style={{
            background: tenant.cover_url
              ? undefined
              : `radial-gradient(circle at top right, ${themeColors.accent}36, transparent 58%), linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.background} 100%)`,
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/35" />
            </>
          )}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-8 text-white space-y-5">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/15 transition"
            >
              <MenuzLogo forceTheme="dark" height={28} />
            </Link>

            <div className="flex items-center gap-2">
              {/* In-App Notifications Bell + Push Opt-in */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setUnreadCount(0);
                  }}
                  className="relative p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 transition"
                  aria-label="الإشعارات"
                  title="الإشعارات"
                >
                  <Bell className="w-4 h-4" style={{ color: themeColors.accent }} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow"
                      style={{
                        backgroundColor: themeColors.accent,
                        color: themeColors.buttonText,
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute left-0 mt-2 w-80 max-w-[85vw] rounded-2xl p-4 border shadow-2xl z-50 space-y-3"
                      style={{
                        backgroundColor: themeColors.card,
                        color: themeColors.text,
                        borderColor: themeColors.border,
                      }}
                    >
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: themeColors.border }}>
                        <span className="font-extrabold text-xs flex items-center gap-1.5" style={{ color: themeColors.accent }}>
                          <Bell className="w-3.5 h-3.5" />
                          <span>إشعارات {tenant.name_ar}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setNotifOpen(false)}
                          className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {pushSupported && (
                        <button
                          type="button"
                          disabled={subscribingPush}
                          onClick={handleToggleWebPush}
                          className="w-full rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border transition"
                          style={{
                            borderColor: themeColors.accent,
                            backgroundColor: pushSubscribed
                              ? themeColors.accentSoft
                              : "transparent",
                            color: themeColors.accent,
                          }}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>
                            {pushSubscribed
                              ? "إشعارات العروض مفعّلة (إلغاء)"
                              : "اشترك لتنبيهات العروض"}
                          </span>
                        </button>
                      )}

                      {notifications.length === 0 ? (
                        <p className="text-xs text-center py-4" style={{ color: themeColors.mutedText }}>
                          لا توجد إشعارات حالياً.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              className="rounded-xl p-3 border space-y-1"
                              style={{
                                backgroundColor: themeColors.surface,
                                borderColor: themeColors.border,
                              }}
                            >
                              <p className="font-bold text-xs" style={{ color: themeColors.accent }}>
                                {n.title}
                              </p>
                              <p className="text-xs leading-relaxed">{n.body}</p>
                              <p className="text-[10px]" style={{ color: themeColors.mutedText }}>
                                {formatArabicDate(n.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <PwaInstallButton
                variant="outline"
                appTitle={tenant.name_ar}
                label="تثبيت المنيو"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              />
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 transition"
                aria-label="تبديل الوضع الليلي"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" style={{ color: themeColors.accent }} />
                ) : (
                  <Moon className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Tenant Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 shadow-2xl shrink-0"
              style={{
                borderColor: themeColors.accent,
                backgroundColor: themeColors.primary,
              }}
            >
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
                <div
                  className="w-full h-full flex items-center justify-center text-3xl font-black"
                  style={{ color: themeColors.accent }}
                >
                  {tenant.name_ar.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-3xl sm:text-4xl font-black text-white">
                  {tenant.name_ar}
                </h1>
                {tenant.name_en && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-white/10 border border-white/15"
                    style={{ color: themeColors.accent }}
                  >
                    {tenant.name_en}
                  </span>
                )}
              </div>

              {tenant.description && (
                <p className="text-sm text-slate-200 max-w-2xl leading-relaxed">
                  {tenant.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-200 pt-1">
                {tenant.address && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                    <MapPin className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-bold transition"
                    style={{
                      backgroundColor: themeColors.accentSoft,
                      borderColor: themeColors.accent,
                      color: "#FFFFFF",
                    }}
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

              {/* TOP SOCIAL ICONS BAR */}
              <div className="pt-1">
                <TenantSocialIcons
                  tenant={tenant}
                  themeColors={themeColors}
                  inHeader
                />
              </div>
            </div>
          </div>

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
        <div
          className="py-2.5 overflow-hidden border-b shadow-md"
          style={{
            backgroundColor: themeColors.accent,
            color: themeColors.buttonText,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex w-max animate-marquee-rtl gap-10 px-4">
            {[...activeOffers, ...activeOffers].map((offer, i) => (
              <div
                key={`${offer.id}-${i}`}
                className="inline-flex items-center gap-2.5 text-sm font-bold shrink-0"
              >
                <span className="px-2.5 py-0.5 rounded-full bg-black/25 text-white text-xs">
                  {offer.badge_text}
                </span>
                <span>{offer.title}</span>
                {offer.discount_text && (
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-900 text-xs font-black">
                    {offer.discount_text}
                  </span>
                )}
                {offer.description && (
                  <span className="opacity-90 font-normal text-xs">
                    — {offer.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIRST-VISIT PWA ONBOARDING HINT */}
      <PwaOnboardingHint
        slug={tenant.slug}
        appTitle={tenant.name_ar}
        accentColor={themeColors.accent}
        buttonTextColor={themeColors.buttonText}
      />

      {/* FEATURED CAROUSEL (Smooth Auto-Scroll, pauses on interaction / reduced-motion) */}
      {featuredItems.length > 0 && (
        <section className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg sm:text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: themeColors.accent }} />
              <span>الأصناف المميزة</span>
            </h2>
            {featuredItems.length > 1 && !reducedMotion && (
              <span className="text-[11px] font-semibold" style={{ color: themeColors.mutedText }}>
                {featuredPaused ? "تم إيقاف التمرير" : "يتحرك تلقائياً"}
              </span>
            )}
          </div>

          <div
            ref={featuredStripRef}
            onMouseEnter={() => setFeaturedPaused(true)}
            onMouseLeave={() => setFeaturedPaused(false)}
            onTouchStart={() => setFeaturedPaused(true)}
            onFocus={() => setFeaturedPaused(true)}
            className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x"
          >
            {featuredItems.map((item) => {
              const qty = getQty(item.id);
              return (
                <div
                  key={item.id}
                  className="snap-start shrink-0 w-56 rounded-2xl overflow-hidden border flex flex-col shadow-sm transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                  }}
                >
                  {/* Square Product Card Image */}
                  <div
                    onClick={() => openItemDetail(item)}
                    className="aspect-square w-full relative cursor-pointer"
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
                      <DishArtFallback name={item.name} themeColors={themeColors} />
                    )}
                    <span
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md"
                      style={{
                        backgroundColor: themeColors.primary,
                        color: themeColors.primaryButtonText,
                      }}
                    >
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
                      {(item.ingredients || item.description) && (
                        <p
                          className="text-xs line-clamp-1 mt-0.5"
                          style={{ color: themeColors.mutedText }}
                        >
                          {item.ingredients || item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-black text-sm"
                        style={{ color: themeColors.accent }}
                      >
                        {formatPrice(item.price, tenant.currency)}
                      </span>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:brightness-110"
                          style={{
                            backgroundColor: themeColors.accent,
                            color: themeColors.buttonText,
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>أضف</span>
                        </button>
                      ) : (
                        <div
                          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 border"
                          style={{
                            backgroundColor: themeColors.accentSoft,
                            borderColor: themeColors.accent,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            className="p-0.5"
                            style={{ color: themeColors.accent }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black min-w-[16px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            className="p-0.5"
                            style={{ color: themeColors.accent }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* STICKY CATEGORIES + SEARCH + VIEW MODE SWITCHER */}
      <div
        className="sticky top-0 z-30 mt-5 backdrop-blur-xl border-y"
        style={{
          backgroundColor: `${themeColors.background}EB`,
          borderColor: themeColors.border,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Categories Strip + View Switcher */}
          <div className="flex items-center justify-between gap-3">
            {categories.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                {categories.map((cat) => {
                  const active = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => scrollToCategory(cat.id)}
                      className="shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all border"
                      style={
                        active
                          ? {
                              backgroundColor: themeColors.accent,
                              color: themeColors.buttonText,
                              borderColor: themeColors.accent,
                            }
                          : {
                              backgroundColor: themeColors.card,
                              color: themeColors.text,
                              borderColor: themeColors.border,
                            }
                      }
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* View Mode Switcher */}
            <div
              className="shrink-0 inline-flex items-center gap-1 rounded-xl p-1 border"
              style={{
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              }}
              role="group"
              aria-label="تبديل طريقة العرض"
            >
              {(
                [
                  { key: "cards", icon: LayoutGrid, label: "بطاقات" },
                  { key: "list", icon: List, label: "قائمة" },
                  { key: "classic", icon: BookOpen, label: "كلاسيكي" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => changeViewMode(m.key)}
                  title={m.label}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                  style={
                    viewMode === m.key
                      ? {
                          backgroundColor: themeColors.accent,
                          color: themeColors.buttonText,
                        }
                      : { color: themeColors.mutedText }
                  }
                >
                  <m.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search & Badge Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: themeColors.mutedText }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صنف أو مكوّن..."
                className="w-full rounded-xl pr-10 pl-4 py-2.5 text-sm border focus:outline-none"
                style={{
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                }}
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
              ).map((chip) => {
                const active = badgeFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setBadgeFilter(chip.key)}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition"
                    style={
                      active
                        ? {
                            backgroundColor: themeColors.accentSoft,
                            borderColor: themeColors.accent,
                            color: themeColors.accent,
                          }
                        : {
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                            color: themeColors.mutedText,
                          }
                    }
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RESTORE LAST ORDER BANNER (when cart is empty & recent order exists) */}
      {cart.length === 0 && restorableOrder && (
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-5">
          <div
            className="rounded-2xl p-3.5 border flex items-center justify-between gap-3"
            style={{
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            }}
          >
            <span className="text-xs font-bold">
              هل ترغب في إعادة طلب أصناف طلبك السابق؟
            </span>
            <button
              type="button"
              onClick={restoreLastOrder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition"
              style={{
                backgroundColor: themeColors.accentSoft,
                color: themeColors.accent,
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الطلب السابق</span>
            </button>
          </div>
        </div>
      )}

      {/* MENU CATEGORIES & ITEMS */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {categories.length === 0 ? (
          <EmptyStateCard
            icon={UtensilsCrossed}
            title="القائمة قيد التحديث"
            description="لم تتم إضافة أصناف في هذا المنيو بعد. تفضل بالعودة قريباً."
          />
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
                <div
                  className="flex items-baseline justify-between border-b pb-2.5"
                  style={{ borderColor: themeColors.border }}
                >
                  <div>
                    <h2 className="font-display text-2xl font-black">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-xs mt-0.5" style={{ color: themeColors.mutedText }}>
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: themeColors.accentSoft,
                      color: themeColors.accent,
                    }}
                  >
                    {catItems.length} أصناف
                  </span>
                </div>

                {/* VIEW MODE: ELEGANT SQUARE CARDS */}
                {viewMode === "cards" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catItems.map((item) => {
                      const unavailable =
                        !item.is_available ||
                        item.badges.includes("unavailable");
                      const qty = getQty(item.id);

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "group rounded-2xl p-3.5 border flex gap-3.5 items-stretch shadow-sm transition",
                            unavailable && "opacity-65 grayscale-[40%]"
                          )}
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        >
                          <div
                            onClick={() => openItemDetail(item)}
                            className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 relative cursor-pointer"
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
                              <DishArtFallback name={item.name} themeColors={themeColors} />
                            )}
                          </div>

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
                                <p
                                  className="text-xs line-clamp-2 leading-relaxed"
                                  style={{ color: themeColors.mutedText }}
                                >
                                  {item.ingredients || item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="font-black text-base"
                                  style={{ color: themeColors.accent }}
                                >
                                  {formatPrice(item.price, tenant.currency)}
                                </span>
                                {item.original_price &&
                                  item.original_price > item.price && (
                                    <span className="text-xs line-through opacity-55">
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
                                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition hover:brightness-110"
                                    style={{
                                      backgroundColor: themeColors.accent,
                                      color: themeColors.buttonText,
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>أضف</span>
                                  </button>
                                ) : (
                                  <div
                                    className="inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 border"
                                    style={{
                                      backgroundColor: themeColors.accentSoft,
                                      borderColor: themeColors.accent,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => updateQty(item.id, -1)}
                                      className="p-0.5"
                                      style={{ color: themeColors.accent }}
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
                                      className="p-0.5"
                                      style={{ color: themeColors.accent }}
                                      aria-label="زيادة الكمية"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* VIEW MODE: COMPACT LIST */}
                {viewMode === "list" && (
                  <div className="space-y-2.5">
                    {catItems.map((item) => {
                      const unavailable =
                        !item.is_available ||
                        item.badges.includes("unavailable");
                      const qty = getQty(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl p-3 border flex items-center justify-between gap-3",
                            unavailable && "opacity-60"
                          )}
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        >
                          <div
                            onClick={() => openItemDetail(item)}
                            className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                          >
                            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative">
                              {item.image_url ? (
                                <Image
                                  src={item.image_url}
                                  alt={item.name}
                                  fill
                                  loading="lazy"
                                  className="object-cover"
                                />
                              ) : (
                                <DishArtFallback
                                  name={item.name}
                                  themeColors={themeColors}
                                  compact
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-sm truncate">
                                {item.name}
                              </h3>
                              {(item.ingredients || item.description) && (
                                <p
                                  className="text-xs truncate"
                                  style={{ color: themeColors.mutedText }}
                                >
                                  {item.ingredients || item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className="font-black text-sm"
                              style={{ color: themeColors.accent }}
                            >
                              {formatPrice(item.price, tenant.currency)}
                            </span>
                            {!unavailable &&
                              (qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:brightness-110"
                                  style={{
                                    backgroundColor: themeColors.accent,
                                    color: themeColors.buttonText,
                                  }}
                                  aria-label={`أضف ${item.name}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-xl px-2 py-1 border"
                                  style={{
                                    backgroundColor: themeColors.accentSoft,
                                    borderColor: themeColors.accent,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="p-0.5"
                                    style={{ color: themeColors.accent }}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-black">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, 1)}
                                    className="p-0.5"
                                    style={{ color: themeColors.accent }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* VIEW MODE: CLASSIC PAPER-INSPIRED MENU */}
                {viewMode === "classic" && (
                  <div
                    className="rounded-3xl p-4 sm:p-6 border divide-y"
                    style={{
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    }}
                  >
                    {catItems.map((item) => {
                      const unavailable =
                        !item.is_available ||
                        item.badges.includes("unavailable");
                      const qty = getQty(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4",
                            unavailable && "opacity-60"
                          )}
                          style={{ borderColor: themeColors.border }}
                        >
                          <div
                            onClick={() => openItemDetail(item)}
                            className="cursor-pointer min-w-0 flex-1 space-y-0.5"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-base">{item.name}</h3>
                              {unavailable && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                                  غير متوفر
                                </span>
                              )}
                            </div>
                            {(item.ingredients || item.description) && (
                              <p
                                className="text-xs"
                                style={{ color: themeColors.mutedText }}
                              >
                                {item.ingredients || item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className="font-black text-sm sm:text-base"
                              style={{ color: themeColors.accent }}
                            >
                              {formatPrice(item.price, tenant.currency)}
                            </span>
                            {!unavailable &&
                              (qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold border transition"
                                  style={{
                                    borderColor: themeColors.accent,
                                    color: themeColors.accent,
                                  }}
                                >
                                  + أضف
                                </button>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-xl px-2 py-1 border"
                                  style={{
                                    backgroundColor: themeColors.accentSoft,
                                    borderColor: themeColors.accent,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="p-0.5"
                                    style={{ color: themeColors.accent }}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-black">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, 1)}
                                    className="p-0.5"
                                    style={{ color: themeColors.accent }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}

        {filteredItems.length === 0 && items.length > 0 && (
          <EmptyStateCard
            icon={Search}
            title="لا توجد نتائج مطابقة لبحثك"
            description="جرّب البحث بكلمة أخرى أو إعادة ضبط الفلتر لعرض كامل القائمة."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setBadgeFilter("all");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{
                  backgroundColor: themeColors.accent,
                  color: themeColors.buttonText,
                }}
              >
                إعادة ضبط الفلترة
              </button>
            }
          />
        )}
      </main>

      {/* PROFESSIONAL TENANT & MENUZ BRANDED FOOTER */}
      <footer
        className="border-t mt-10"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {/* Electronic Wallets Strip */}
          {wallets.length > 0 && (
            <div
              className="rounded-3xl p-6 border space-y-4"
              style={{
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              }}
            >
              <div className="flex items-center gap-2">
                <WalletIcon className="w-5 h-5" style={{ color: themeColors.accent }} />
                <h3 className="font-extrabold text-base">
                  المحافظ الإلكترونية المتاحة للدفع
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3.5 border"
                    style={{
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.border,
                    }}
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
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: themeColors.accentSoft,
                            color: themeColors.accent,
                          }}
                        >
                          <WalletIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{w.name}</p>
                        <p
                          dir="ltr"
                          className="text-xs font-mono truncate"
                          style={{ color: themeColors.accent }}
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
                      className="p-2 rounded-xl transition shrink-0"
                      style={{
                        backgroundColor: themeColors.accentSoft,
                        color: themeColors.accent,
                      }}
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

          {/* Tenant info + Bottom Social Icons */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              {tenant.logo_url && (
                <Image
                  src={tenant.logo_url}
                  alt={tenant.name_ar}
                  width={52}
                  height={52}
                  className="rounded-2xl object-cover border"
                  style={{ borderColor: themeColors.accent }}
                />
              )}
              <div>
                <h4 className="font-black text-lg">{tenant.name_ar}</h4>
                {tenant.address && (
                  <p className="text-xs" style={{ color: themeColors.mutedText }}>
                    {tenant.address}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <TenantSocialIcons tenant={tenant} themeColors={themeColors} />
              <PwaInstallButton
                variant="outline"
                appTitle={tenant.name_ar}
                label="تثبيت التطبيق"
              />
            </div>
          </div>

          {/* MENUZ Branded Signature Block */}
          <div
            className="rounded-3xl p-5 border flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
              <MenuzLogo height={38} />
              <div className="space-y-0.5">
                <p className="font-display font-black text-sm" style={{ color: themeColors.accent }}>
                  امسح.. اطلب.. واستمتع
                </p>
                <p className="text-xs font-bold">
                  القائمة الرقمية الذكية.. لتجربة فريدة
                </p>
                <p className="text-[11px]" style={{ color: themeColors.mutedText }}>
                  تصفح فوري وسهل من جوالك، مع سلة طلبات ذكية وتجربة ضيافة عصرية.
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition hover:brightness-110"
              style={{
                backgroundColor: themeColors.primary,
                color: themeColors.primaryButtonText,
              }}
            >
              <Home className="w-3.5 h-3.5" />
              <span>منصة مينوز</span>
            </Link>
          </div>

          <div
            className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{
              borderColor: themeColors.border,
              color: themeColors.mutedText,
            }}
          >
            <div className="flex items-center gap-3 text-center sm:text-right">
              <SamerzLogo size={30} className="shrink-0" />
              <p className="font-semibold">
                فكرة وتصميم وبرمجة شركة سامرز للحلول الذكية 776951100 - جميع الحقوق محفوظة © 2027
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-1 opacity-70 hover:opacity-100 transition shrink-0"
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
              className="w-full rounded-2xl px-5 py-4 shadow-2xl flex items-center justify-between gap-4 hover:brightness-110 transition"
              style={{
                backgroundColor: themeColors.accent,
                color: themeColors.buttonText,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-black/20 text-white flex items-center justify-center font-black text-sm">
                  {cartCount}
                </span>
                <div className="text-right">
                  <p className="font-extrabold text-sm">عرض سلة الطلبات</p>
                  <p className="text-[11px] opacity-85">
                    اضغط لمراجعة الطلب والإرسال السريع
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
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: themeColors.card,
                color: themeColors.text,
                borderColor: themeColors.border,
              }}
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
                  <DishArtFallback
                    name={selectedItem.name}
                    themeColors={themeColors}
                  />
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
                      <p className="text-sm mt-1" style={{ color: themeColors.mutedText }}>
                        {selectedItem.ingredients}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xl font-black shrink-0"
                    style={{ color: themeColors.accent }}
                  >
                    {formatPrice(selectedItem.price, tenant.currency)}
                  </span>
                </div>
                {selectedItem.description && (
                  <p className="text-sm leading-relaxed" style={{ color: themeColors.mutedText }}>
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
                    className="w-full rounded-2xl py-3.5 text-sm font-extrabold transition hover:brightness-110"
                    style={{
                      backgroundColor: themeColors.accent,
                      color: themeColors.buttonText,
                    }}
                  >
                    أضف للسلة — {formatPrice(selectedItem.price, tenant.currency)}
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

      {/* SLIDE-OVER CART & SIMPLIFIED CHECKOUT DRAWER */}
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
              className="w-full max-w-md h-full border-r flex flex-col shadow-2xl"
              style={{
                backgroundColor: themeColors.background,
                color: themeColors.text,
                borderColor: themeColors.border,
              }}
            >
              {/* Cart Header with MENUZ Logo */}
              <div
                className="p-4 sm:p-5 border-b flex items-center justify-between gap-2"
                style={{ borderColor: themeColors.border }}
              >
                <div className="flex items-center gap-3">
                  <MenuzLogo height={28} />
                  <h2 className="text-base sm:text-lg font-black">
                    {invoiceStep ? "إتمام الطلب" : "سلة الطلبات"}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-500 hover:bg-rose-500/10"
                    >
                      إفراغ السلة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {cart.length === 0 ? (
                  <div className="py-16 text-center space-y-4">
                    <ShoppingBag className="w-12 h-12 mx-auto opacity-45" />
                    <p className="font-bold" style={{ color: themeColors.mutedText }}>
                      سلتك فارغة حالياً
                    </p>
                    {restorableOrder && (
                      <button
                        type="button"
                        onClick={restoreLastOrder}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border"
                        style={{
                          borderColor: themeColors.accent,
                          color: themeColors.accent,
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة الطلب السابق</span>
                      </button>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => setCartOpen(false)}
                        className="text-xs font-bold underline"
                        style={{ color: themeColors.accent }}
                      >
                        العودة إلى المنيو
                      </button>
                    </div>
                  </div>
                ) : !invoiceStep ? (
                  <>
                    <div className="space-y-3">
                      {cart.map((line) => (
                        <div
                          key={line.item.id}
                          className="rounded-2xl p-3.5 border flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">
                              {line.item.name}
                            </p>
                            <p
                              className="text-xs font-bold mt-0.5"
                              style={{ color: themeColors.accent }}
                            >
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
                              className="w-7 h-7 rounded-lg border flex items-center justify-center"
                              style={{ borderColor: themeColors.border }}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-sm w-5 text-center">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(line.item.id, 1)}
                              className="w-7 h-7 rounded-lg border flex items-center justify-center"
                              style={{ borderColor: themeColors.border }}
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

                    <div
                      className="rounded-2xl p-4 border flex items-center justify-between"
                      style={{
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      }}
                    >
                      <span className="font-bold text-sm">الإجمالي</span>
                      <span
                        className="font-black text-xl"
                        style={{ color: themeColors.accent }}
                      >
                        {formatPrice(cartTotal, tenant.currency)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div
                      className="rounded-2xl p-3.5 border space-y-2"
                      style={{
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      }}
                    >
                      <div className="flex items-center justify-between text-xs font-bold" style={{ color: themeColors.mutedText }}>
                        <span>الأصناف ({cartCount})</span>
                        <button
                          type="button"
                          onClick={() => setInvoiceStep(false)}
                          className="hover:underline"
                          style={{ color: themeColors.accent }}
                        >
                          تعديل السلة
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
                      <div
                        className="pt-2 border-t flex justify-between font-black text-sm"
                        style={{ borderColor: themeColors.border }}
                      >
                        <span>الإجمالي</span>
                        <span style={{ color: themeColors.accent }}>
                          {formatPrice(cartTotal, tenant.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Optional Name & Optional Phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">الاسم (اختياري)</label>
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="اسمك (اختياري)"
                          className="w-full rounded-xl px-3 py-2.5 text-sm border"
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">الجوال (اختياري)</label>
                        <input
                          dir="ltr"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="اختياري"
                          className="w-full rounded-xl px-3 py-2.5 text-sm text-right border"
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {tenant.has_delivery && (
                        <button
                          type="button"
                          onClick={() => setOrderType("delivery")}
                          className="rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 transition"
                          style={
                            orderType === "delivery"
                              ? {
                                  backgroundColor: themeColors.accentSoft,
                                  borderColor: themeColors.accent,
                                  color: themeColors.accent,
                                }
                              : { borderColor: themeColors.border }
                          }
                        >
                          <Truck className="w-4 h-4" />
                          <span>توصيل للموقع</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOrderType("pickup")}
                        className={cn(
                          "rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 transition",
                          !tenant.has_delivery && "col-span-2"
                        )}
                        style={
                          orderType === "pickup"
                            ? {
                                backgroundColor: themeColors.accentSoft,
                                borderColor: themeColors.accent,
                                color: themeColors.accent,
                              }
                            : { borderColor: themeColors.border }
                        }
                      >
                        <Store className="w-4 h-4" />
                        <span>استلام من الفرع</span>
                      </button>
                    </div>

                    {orderType === "delivery" && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold">
                          عنوان التوصيل *
                        </label>
                        <input
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="الحي، الشارع، أقرب معلم..."
                          className="w-full rounded-xl px-3 py-2.5 text-sm border"
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.border,
                          }}
                        />
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <label className="text-xs font-bold block">طريقة الدفع</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className="rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 transition"
                          style={
                            paymentMethod === "cash"
                              ? {
                                  backgroundColor: themeColors.accentSoft,
                                  borderColor: themeColors.accent,
                                  color: themeColors.accent,
                                }
                              : { borderColor: themeColors.border }
                          }
                        >
                          <Banknote className="w-4 h-4" />
                          <span>نقداً عند الاستلام</span>
                        </button>

                        <button
                          type="button"
                          disabled={wallets.length === 0}
                          onClick={() => setPaymentMethod("wallet")}
                          className="rounded-xl py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 disabled:opacity-45 transition"
                          style={
                            paymentMethod === "wallet"
                              ? {
                                  backgroundColor: themeColors.accentSoft,
                                  borderColor: themeColors.accent,
                                  color: themeColors.accent,
                                }
                              : { borderColor: themeColors.border }
                          }
                        >
                          <WalletIcon className="w-4 h-4" />
                          <span>محفظة إلكترونية</span>
                        </button>
                      </div>

                      {paymentMethod === "wallet" && wallets.length > 0 && (
                        <div
                          className="rounded-2xl p-3.5 border space-y-3"
                          style={{
                            backgroundColor: themeColors.card,
                            borderColor: themeColors.accent,
                          }}
                        >
                          <div className="space-y-2">
                            {wallets.map((w) => (
                              <div
                                key={w.id}
                                onClick={() => setSelectedWalletId(w.id)}
                                className="cursor-pointer rounded-xl p-2.5 border flex items-center justify-between gap-2 transition"
                                style={{
                                  borderColor:
                                    selectedWallet?.id === w.id
                                      ? themeColors.accent
                                      : themeColors.border,
                                  backgroundColor:
                                    selectedWallet?.id === w.id
                                      ? themeColors.accentSoft
                                      : "transparent",
                                }}
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
                                    <WalletIcon
                                      className="w-4 h-4 shrink-0"
                                      style={{ color: themeColors.accent }}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">
                                      {w.name}
                                      {w.account_name ? ` (${w.account_name})` : ""}
                                    </p>
                                    <p
                                      dir="ltr"
                                      className="text-xs font-mono"
                                      style={{ color: themeColors.accent }}
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
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                  style={{
                                    backgroundColor: themeColors.accentSoft,
                                    color: themeColors.accent,
                                  }}
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
                              className="w-full rounded-xl px-3 py-2 text-sm text-right border"
                              style={{
                                backgroundColor: themeColors.surface,
                                borderColor: themeColors.border,
                              }}
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
                        className="w-full rounded-xl px-3 py-2.5 text-sm border"
                        style={{
                          backgroundColor: themeColors.card,
                          borderColor: themeColors.border,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div
                  className="p-5 border-t space-y-2.5"
                  style={{ borderColor: themeColors.border }}
                >
                  {!invoiceStep ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCartOpen(false)}
                        className="rounded-2xl px-4 py-3.5 text-xs font-bold border"
                        style={{ borderColor: themeColors.border }}
                      >
                        العودة للمنيو
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceStep(true)}
                        className="flex-1 rounded-2xl py-3.5 text-sm font-extrabold transition hover:brightness-110"
                        style={{
                          backgroundColor: themeColors.accent,
                          color: themeColors.buttonText,
                        }}
                      >
                        متابعة الطلب ({formatPrice(cartTotal, tenant.currency)})
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={submittingOrder}
                        onClick={() => handleSendOrder("whatsapp")}
                        className="w-full rounded-2xl py-3.5 text-sm font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-65"
                      >
                        {submittingOrder ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                        <span>
                          {submittingOrder
                            ? "جاري تأكيد الطلب..."
                            : "إرسال الطلب عبر واتساب"}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={submittingOrder}
                        onClick={() => handleSendOrder("sms")}
                        className="w-full rounded-2xl py-3 text-xs font-bold border flex items-center justify-center gap-2 transition disabled:opacity-65"
                        style={{ borderColor: themeColors.border }}
                      >
                        <MessageSquareText
                          className="w-4 h-4"
                          style={{ color: themeColors.accent }}
                        />
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

      {/* THANK YOU SCREEN + OPTIONAL SUPER-ADMIN-ONLY RATING */}
      <AnimatePresence>
        {completedOrder && (
          <ThankYouFeedbackModal
            tenantId={tenant.id}
            tenantName={tenant.name_ar}
            themeColors={themeColors}
            summary={completedOrder}
            onClose={() => setCompletedOrder(null)}
            onRestoreOrder={restoreLastOrder}
            onToast={toast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
