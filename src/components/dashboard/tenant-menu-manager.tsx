"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Plus,
  Trash2,
  Edit3,
  Upload,
  Layers,
  Utensils,
  Tag,
  Wallet as WalletIcon,
  Settings,
  Check,
  X,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  compressImageFile,
  MAX_CLIENT_IMAGE_BYTES,
  validateImageFile,
} from "@/lib/image-compress";
import { useApp } from "@/components/providers/theme-provider";
import { EmptyStateCard } from "@/components/ui/skeletons";
import { cn, formatArabicDate, formatPrice } from "@/lib/utils";
import type {
  Category,
  MenuBadge,
  MenuItem,
  Offer,
  Tenant,
  TenantNotification,
  Wallet,
} from "@/types/database";

type SubTab =
  | "items"
  | "categories"
  | "offers"
  | "notifications"
  | "wallets"
  | "settings";

const ALL_BADGES: Array<{ key: MenuBadge; label: string }> = [
  { key: "best_seller", label: "🔥 الأكثر طلباً" },
  { key: "new", label: "🆕 جديد" },
  { key: "limited_offer", label: "⏰ عرض محدود" },
  { key: "unavailable", label: "🚫 غير متوفر" },
];

export function TenantMenuManager({
  tenant,
  categories: initialCats,
  items: initialItems,
  offers: initialOffers,
  wallets: initialWallets,
  notifications: initialNotifications = [],
  isSuperAdmin = false,
  onTenantUpdated,
}: {
  tenant: Tenant;
  categories: Category[];
  items: MenuItem[];
  offers: Offer[];
  wallets: Wallet[];
  notifications?: TenantNotification[];
  isSuperAdmin?: boolean;
  onTenantUpdated?: (t: Tenant) => void;
}) {
  const { toast } = useApp();
  const supabase = createClient();

  const [subTab, setSubTab] = useState<SubTab>("items");
  const [categories, setCategories] = useState<Category[]>(initialCats);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [notifications, setNotifications] =
    useState<TenantNotification[]>(initialNotifications);

  // Category Form
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Item Form
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCatId, setItemCatId] = useState(initialCats[0]?.id || "");
  const [itemPrice, setItemPrice] = useState("");
  const [itemOrigPrice, setItemOrigPrice] = useState("");
  const [itemIngredients, setItemIngredients] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemBadges, setItemBadges] = useState<MenuBadge[]>([]);
  const [itemFeatured, setItemFeatured] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Offer Form
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDesc, setOfferDesc] = useState("");
  const [offerBadge, setOfferBadge] = useState("عرض خاص");
  const [offerDiscount, setOfferDiscount] = useState("");
  const [offerStarts, setOfferStarts] = useState("");
  const [offerEnds, setOfferEnds] = useState("");

  // Wallet Form
  const [walletName, setWalletName] = useState("");
  const [walletNumber, setWalletNumber] = useState("");
  const [walletAccountName, setWalletAccountName] = useState("");
  const [walletLogo, setWalletLogo] = useState("");

  // Notification Form (7-day auto expiry by default)
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifDays, setNotifDays] = useState("7");
  const [savingNotif, setSavingNotif] = useState(false);

  // Client Settings Form (Restricted to contact/social/delivery/story)
  const [story, setStory] = useState(tenant.story || "");
  const [description, setDescription] = useState(tenant.description || "");
  const [address, setAddress] = useState(tenant.address || "");
  const [phone, setPhone] = useState(tenant.phone || "");
  const [whatsapp, setWhatsapp] = useState(tenant.whatsapp || "");
  const [instagram, setInstagram] = useState(tenant.instagram || "");
  const [facebook, setFacebook] = useState(tenant.facebook || "");
  const [tiktok, setTiktok] = useState(tenant.tiktok || "");
  const [hasDelivery, setHasDelivery] = useState(tenant.has_delivery);
  const [deliveryNote, setDeliveryNote] = useState(tenant.delivery_note || "");
  const [savingSettings, setSavingSettings] = useState(false);

  const uploadMedia = async (file: File, folder: string): Promise<string | null> => {
    const check = await validateImageFile(file);
    if (!check.valid) {
      toast(check.error, "error");
      return null;
    }

    setUploading(true);
    try {
      const compressed = await compressImageFile(file);
      if (compressed.size > MAX_CLIENT_IMAGE_BYTES) {
        toast("حجم الصورة يتجاوز الحد الأقصى المسموح (4 ميجابايت)", "error");
        return null;
      }
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("folder", folder);
      formData.append("tenantId", tenant.id);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        toast(data?.error || "فشل رفع الصورة", "error");
        return null;
      }

      toast("تم ضغط الصورة والتحقق منها ورفعها بنجاح!", "success");
      return data.url as string;
    } catch {
      toast("تعذر الاتصال بخدمة رفع الصور", "error");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // --- CATEGORIES ---
  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCatId) {
      const { data, error } = await supabase
        .from("categories")
        .update({ name: catName.trim(), description: catDesc.trim() || null })
        .eq("id", editingCatId)
        .select()
        .single();
      if (error) return toast(error.message, "error");
      setCategories((p) => p.map((c) => (c.id === editingCatId ? data : c)));
      setEditingCatId(null);
      toast("تم تحديث القسم", "success");
    } else {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          tenant_id: tenant.id,
          name: catName.trim(),
          description: catDesc.trim() || null,
          sort_order: categories.length + 1,
        })
        .select()
        .single();
      if (error) return toast(error.message, "error");
      setCategories((p) => [...p, data]);
      if (!itemCatId) setItemCatId(data.id);
      toast("تمت إضافة القسم", "success");
    }
    setCatName("");
    setCatDesc("");
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    setCategories((p) => p.filter((c) => c.id !== id));
    setItems((p) => p.filter((i) => i.category_id !== id));
    toast("تم حذف القسم وأصنافه", "info");
  };

  // --- MENU ITEMS ---
  const openCreateItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemCatId(categories[0]?.id || "");
    setItemPrice("");
    setItemOrigPrice("");
    setItemIngredients("");
    setItemDesc("");
    setItemImageUrl("");
    setItemBadges([]);
    setItemFeatured(false);
    setItemAvailable(true);
    setItemFormOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCatId(item.category_id);
    setItemPrice(String(item.price));
    setItemOrigPrice(item.original_price ? String(item.original_price) : "");
    setItemIngredients(item.ingredients || "");
    setItemDesc(item.description || "");
    setItemImageUrl(item.image_url || "");
    setItemBadges(item.badges || []);
    setItemFeatured(item.is_featured);
    setItemAvailable(item.is_available);
    setItemFormOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCatId) return toast("أضف قسماً أولاً قبل إضافة الأصناف", "error");

    const payload = {
      tenant_id: tenant.id,
      category_id: itemCatId,
      name: itemName.trim(),
      price: Number(itemPrice),
      original_price: itemOrigPrice ? Number(itemOrigPrice) : null,
      ingredients: itemIngredients.trim() || null,
      description: itemDesc.trim() || null,
      image_url: itemImageUrl.trim() || null,
      badges: itemBadges,
      is_featured: itemFeatured,
      is_available: itemAvailable,
    };

    if (editingItem) {
      const { data, error } = await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", editingItem.id)
        .select()
        .single();
      if (error) return toast(error.message, "error");
      setItems((p) => p.map((i) => (i.id === editingItem.id ? data : i)));
      toast("تم تحديث الصنف", "success");
    } else {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ ...payload, sort_order: items.length + 1 })
        .select()
        .single();
      if (error) return toast(error.message, "error");
      setItems((p) => [...p, data]);
      toast("تمت إضافة الصنف", "success");
    }
    setItemFormOpen(false);
  };

  const toggleItemAvail = async (item: MenuItem) => {
    const { data, error } = await supabase
      .from("menu_items")
      .update({ is_available: !item.is_available })
      .eq("id", item.id)
      .select()
      .single();
    if (error) return toast(error.message, "error");
    setItems((p) => p.map((i) => (i.id === item.id ? data : i)));
    toast(
      data.is_available ? "تم تفعيل الصنف" : "تم تمييز الصنف كغير متوفر",
      "info"
    );
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    setItems((p) => p.filter((i) => i.id !== id));
    toast("تم حذف الصنف", "info");
  };

  // --- OFFERS ---
  const addOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("offers")
      .insert({
        tenant_id: tenant.id,
        title: offerTitle.trim(),
        description: offerDesc.trim() || null,
        badge_text: offerBadge.trim() || "عرض خاص",
        discount_text: offerDiscount.trim() || null,
        starts_at: offerStarts ? new Date(offerStarts).toISOString() : null,
        ends_at: offerEnds ? new Date(offerEnds).toISOString() : null,
        is_active: true,
      })
      .select()
      .single();
    if (error) return toast(error.message, "error");
    setOffers((p) => [data, ...p]);
    setOfferTitle("");
    setOfferDesc("");
    setOfferDiscount("");
    setOfferStarts("");
    setOfferEnds("");
    toast("تمت إضافة العرض المجدول", "success");
  };

  const deleteOffer = async (id: string) => {
    const { error } = await supabase.from("offers").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    setOffers((p) => p.filter((o) => o.id !== id));
    toast("تم حذف العرض", "info");
  };

  // --- WALLETS ---
  const addWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("wallets")
      .insert({
        tenant_id: tenant.id,
        name: walletName.trim(),
        account_number: walletNumber.trim(),
        account_name: walletAccountName.trim() || null,
        logo_url: walletLogo.trim() || null,
        sort_order: wallets.length + 1,
        is_active: true,
      })
      .select()
      .single();
    if (error) return toast(error.message, "error");
    setWallets((p) => [...p, data]);
    setWalletName("");
    setWalletNumber("");
    setWalletAccountName("");
    setWalletLogo("");
    toast("تمت إضافة المحفظة الإلكترونية", "success");
  };

  const deleteWallet = async (id: string) => {
    const { error } = await supabase.from("wallets").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    setWallets((p) => p.filter((w) => w.id !== id));
    toast("تم حذف المحفظة", "info");
  };

  // --- IN-APP NOTIFICATIONS ---
  const addNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSavingNotif(true);
    try {
      const days = Math.min(30, Math.max(1, Number(notifDays) || 7));
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          title: notifTitle.trim(),
          body: notifBody.trim(),
          daysValid: days,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.notification) {
        return toast(payload.error || "تعذر إرسال الإشعار", "error");
      }

      setNotifications((p) => [payload.notification, ...p]);
      setNotifTitle("");
      setNotifBody("");
      setNotifDays("7");
      const extra =
        payload.pushSent > 0
          ? ` (تم دفع التنبيه لـ ${payload.pushSent} جهاز مشترك)`
          : "";
      toast(`تم نشر الإشعار وسيظهر فوراً في المنيو العام${extra}!`, "success");
    } finally {
      setSavingNotif(false);
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);
    if (error) return toast(error.message, "error");
    setNotifications((p) => p.filter((n) => n.id !== id));
    toast("تم حذف الإشعار", "info");
  };

  // --- CONTACT & DELIVERY SETTINGS ---
  const saveClientSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from("tenants")
          .update({
            story: story || null,
            description: description || null,
            address: address || null,
            phone: phone || null,
            whatsapp: whatsapp || null,
            instagram: instagram || null,
            facebook: facebook || null,
            tiktok: tiktok || null,
            has_delivery: hasDelivery,
            delivery_note: deliveryNote || null,
          })
          .eq("id", tenant.id)
          .select()
          .single();
        if (error) return toast(error.message, "error");
        onTenantUpdated?.(data);
      } else {
        const { error } = await supabase.rpc("update_client_tenant_settings", {
          p_story: story || null,
          p_description: description || null,
          p_address: address || null,
          p_phone: phone || null,
          p_whatsapp: whatsapp || null,
          p_instagram: instagram || null,
          p_facebook: facebook || null,
          p_tiktok: tiktok || null,
          p_has_delivery: hasDelivery,
          p_delivery_note: deliveryNote || null,
        });
        if (error) return toast(error.message, "error");
      }
      toast("تم حفظ بيانات التواصل والتوصيل بنجاح!", "success");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "items", label: `الأصناف (${items.length})`, icon: Utensils },
            { key: "categories", label: `الأقسام (${categories.length})`, icon: Layers },
            { key: "offers", label: `العروض (${offers.length})`, icon: Tag },
            { key: "notifications", label: `الإشعارات (${notifications.length})`, icon: Bell },
            { key: "wallets", label: `المحافظ (${wallets.length})`, icon: WalletIcon },
            { key: "settings", label: "التواصل والتوصيل", icon: Settings },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold border transition",
              subTab === t.key
                ? "bg-orange-gradient text-white border-transparent shadow-orange-glow"
                : "glass-panel hover:border-brand-orange/50"
            )}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ITEMS TAB */}
      {subTab === "items" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-extrabold text-lg">إدارة الأصناف والأسعار</h3>
            <button
              type="button"
              onClick={openCreateItem}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف جديد</span>
            </button>
          </div>

          {itemFormOpen && (
            <form
              onSubmit={saveItem}
              className="rounded-3xl p-6 glass-panel border-brand-orange/40 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold">
                  {editingItem ? `تعديل: ${editingItem.name}` : "صنف جديد"}
                </h4>
                <button
                  type="button"
                  onClick={() => setItemFormOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold">اسم الصنف *</label>
                  <input
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">القسم *</label>
                  <select
                    required
                    value={itemCatId}
                    onChange={(e) => setItemCatId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold">السعر *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold">السعر السابق</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={itemOrigPrice}
                      onChange={(e) => setItemOrigPrice(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold">المكونات</label>
                  <input
                    value={itemIngredients}
                    onChange={(e) => setItemIngredients(e.target.value)}
                    placeholder="خبز طازج، شبس، جبن..."
                    className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">صورة الصنف (ضغط تلقائي)</label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{uploading ? "جاري الرفع..." : "رفع صورة"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const url = await uploadMedia(f, "item");
                          if (url) setItemImageUrl(url);
                        }}
                      />
                    </label>
                    {itemImageUrl && (
                      <span className="text-xs text-emerald-500 font-bold">
                        ✓ تم رفع الصورة
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ALL_BADGES.map((b) => {
                  const active = itemBadges.includes(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() =>
                        setItemBadges((p) =>
                          active ? p.filter((x) => x !== b.key) : [...p, b.key]
                        )
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold border transition",
                        active
                          ? "bg-brand-orange/20 border-brand-orange text-brand-orange"
                          : "border-navy-700/15 dark:border-white/15"
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}

                <label className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border border-navy-700/15 dark:border-white/15 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemFeatured}
                    onChange={(e) => setItemFeatured(e.target.checked)}
                  />
                  <span>⭐ صنف مميز</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border border-navy-700/15 dark:border-white/15 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                  />
                  <span>متوفر للطلب</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
              >
                <Check className="w-4 h-4" />
                <span>{editingItem ? "حفظ التعديلات" : "إضافة الصنف"}</span>
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {items.map((item) => {
              const cat = categories.find((c) => c.id === item.category_id);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl p-4 glass-panel flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        width={54}
                        height={54}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-navy-700/20 flex items-center justify-center shrink-0">
                        <Utensils className="w-5 h-5 text-brand-orange" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {cat?.name || "-"} •{" "}
                        <strong className="text-brand-orange">
                          {formatPrice(item.price, tenant.currency)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleItemAvail(item)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold",
                        item.is_available
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-rose-500/15 text-rose-400"
                      )}
                    >
                      {item.is_available ? "متوفر" : "مخفي"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditItem(item)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
                      title="تعديل"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {subTab === "categories" && (
        <div className="space-y-6">
          <form
            onSubmit={saveCategory}
            className="rounded-3xl p-5 glass-panel grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-bold">اسم القسم *</label>
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="مثال: المشروبات الباردة"
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="sm:col-span-5 space-y-1">
              <label className="text-xs font-bold">وصف قصير (اختياري)</label>
              <input
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
              >
                {editingCatId ? "حفظ" : "إضافة قسم"}
              </button>
              {editingCatId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCatId(null);
                    setCatName("");
                    setCatDesc("");
                  }}
                  className="px-3 rounded-xl border border-white/15 text-xs"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl p-4 glass-panel flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold">{c.name}</h4>
                  {c.description && (
                    <p className="text-xs text-slate-400">{c.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(c.id);
                      setCatName(c.name);
                      setCatDesc(c.description || "");
                    }}
                    className="p-2 rounded-lg hover:bg-white/10"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(c.id)}
                    className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCHEDULED OFFERS TAB */}
      {subTab === "offers" && (
        <div className="space-y-6">
          <form
            onSubmit={addOffer}
            className="rounded-3xl p-6 glass-panel space-y-4"
          >
            <h3 className="font-extrabold text-base">
              جدولة عرض جديد (يختفي تلقائياً عند انتهاء التاريخ)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                placeholder="عنوان العرض *"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <input
                value={offerDiscount}
                onChange={(e) => setOfferDiscount(e.target.value)}
                placeholder="الخصم (مثال: خصم 20%)"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <input
                value={offerBadge}
                onChange={(e) => setOfferBadge(e.target.value)}
                placeholder="نص الشارة (عرض اليوم)"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={offerDesc}
                onChange={(e) => setOfferDesc(e.target.value)}
                placeholder="وصف العرض"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block">
                  يبدأ في (اختياري)
                </label>
                <input
                  type="datetime-local"
                  value={offerStarts}
                  onChange={(e) => setOfferStarts(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block">
                  ينتهي في (اختياري)
                </label>
                <input
                  type="datetime-local"
                  value={offerEnds}
                  onChange={(e) => setOfferEnds(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-xl px-5 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
            >
              إضافة العرض
            </button>
          </form>

          <div className="space-y-3">
            {offers.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl p-4 glass-panel flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-sm">
                    {o.title}{" "}
                    {o.discount_text && (
                      <span className="text-brand-orange">
                        ({o.discount_text})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {o.description || "بدون وصف"}
                    {o.ends_at
                      ? ` • ينتهي: ${new Date(o.ends_at).toLocaleDateString("ar-YE")}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteOffer(o.id)}
                  className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {subTab === "notifications" && (
        <div className="space-y-6">
          <form
            onSubmit={addNotification}
            className="rounded-3xl p-6 glass-panel space-y-4"
          >
            <div className="space-y-1">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-orange" />
                <span>إرسال إشعار فوري لزوار المنيو</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                يظهر الإشعار لحظياً داخل أيقونة الجرس في المنيو العام ويصل كإشعار
                متصفح للمشتركين (على أجهزة iOS يعمل Web Push عند تثبيت المنيو
                على الشاشة الرئيسية في iOS 16.4+). يُحذف الإشعار تلقائياً بعد
                انتهاء مدته.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="عنوان الإشعار *"
                className="sm:col-span-3 rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <div className="space-y-1">
                <select
                  value={notifDays}
                  onChange={(e) => setNotifDays(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
                >
                  <option value="1">ينتهي خلال يوم واحد</option>
                  <option value="3">ينتهي خلال 3 أيام</option>
                  <option value="7">ينتهي خلال 7 أيام (افتراضي)</option>
                  <option value="14">ينتهي خلال 14 يوماً</option>
                  <option value="30">ينتهي خلال 30 يوماً</option>
                </select>
              </div>
            </div>

            <textarea
              required
              rows={2}
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              placeholder="نص الإشعار أو التنبيه للعملاء *"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
            />

            <button
              type="submit"
              disabled={savingNotif}
              className="rounded-xl px-5 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow disabled:opacity-60"
            >
              {savingNotif ? "جاري الإرسال..." : "نشر الإشعار الآن"}
            </button>
          </form>

          {notifications.length === 0 ? (
            <EmptyStateCard
              icon={Bell}
              title="لا توجد إشعارات منشورة"
              description="أرسل أول إشعار ترحيبي أو تنبيه بعرض خاص ليصل فوراً لزوار المنيو."
            />
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const expired = new Date(n.expires_at).getTime() <= Date.now();
                return (
                  <div
                    key={n.id}
                    className="rounded-2xl p-4 glass-panel flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{n.title}</p>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold",
                            expired
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-emerald-500/15 text-emerald-500"
                          )}
                        >
                          {expired ? "منتهي" : "نشط"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {n.body}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ينتهي في: {formatArabicDate(n.expires_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteNotification(n.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500 shrink-0"
                      title="حذف الإشعار"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WALLETS TAB */}
      {subTab === "wallets" && (
        <div className="space-y-6">
          <form
            onSubmit={addWallet}
            className="rounded-3xl p-6 glass-panel space-y-4"
          >
            <h3 className="font-extrabold text-base">
              إضافة محفظة إلكترونية (جيب، جوالي، ون كاش، فلوسك...)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="اسم المحفظة (مثال: جيب) *"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <input
                required
                dir="ltr"
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                placeholder="رقم المحفظة / الحساب *"
                className="rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
              <input
                value={walletAccountName}
                onChange={(e) => setWalletAccountName(e.target.value)}
                placeholder="اسم صاحب الحساب (اختياري)"
                className="rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>شعار المحفظة (اختياري)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadMedia(f, "wallet");
                    if (url) setWalletLogo(url);
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={uploading}
                className="rounded-xl px-5 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
              >
                حفظ المحفظة
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wallets.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl p-4 glass-panel flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-sm">{w.name}</p>
                  <p dir="ltr" className="text-xs font-mono text-brand-orange">
                    {w.account_number}
                  </p>
                  {w.account_name && (
                    <p className="text-xs text-slate-400">{w.account_name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteWallet(w.id)}
                  className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {subTab === "settings" && (
        <form
          onSubmit={saveClientSettings}
          className="rounded-3xl p-6 glass-panel space-y-4 max-w-3xl"
        >
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg">
              إعدادات التواصل والتوصيل والسوشيال
            </h3>
            {!isSuperAdmin && (
              <p className="text-xs text-slate-400">
                ملاحظة: تعديل اسم الجهة أو الشعار أو الغلاف يتم حصرياً عبر مدير
                النظام لضمان جودة الهوية.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold">رقم الطلبات / الهاتف</label>
              <input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">رقم الواتساب (مع 967)</label>
              <input
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">العنوان</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">حساب إنستغرام</label>
              <input
                dir="ltr"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">فيسبوك (اختياري)</label>
              <input
                dir="ltr"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">تيك توك (اختياري)</label>
              <input
                dir="ltr"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold">وصف مختصر للمنشأة</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold">قصتنا (تظهر في ترويسة المنيو)</label>
            <textarea
              rows={3}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={hasDelivery}
                onChange={(e) => setHasDelivery(e.target.checked)}
              />
              <span>خدمة التوصيل متوفرة</span>
            </label>
            <input
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="ملاحظة التوصيل"
              className="flex-1 rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-xl px-6 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
          >
            {savingSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </form>
      )}
    </div>
  );
}
