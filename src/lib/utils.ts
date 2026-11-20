import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Offer } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "ر.ي"): string {
  const clean = Number(amount);
  const formatted = Number.isInteger(clean)
    ? clean.toLocaleString("en-US")
    : clean.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
  return `${formatted} ${currency}`;
}

export function formatArabicDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function isOfferCurrentlyActive(offer: Offer, now = new Date()): boolean {
  if (!offer.is_active) return false;
  if (offer.starts_at && new Date(offer.starts_at) > now) return false;
  if (offer.ends_at && new Date(offer.ends_at) < now) return false;
  return true;
}

export function validateStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (password.length < 8) errors.push("يجب أن لا تقل عن 8 أحرف");
  if (!/[A-Z]/.test(password)) errors.push("يجب أن تحتوي على حرف كبير (A-Z)");
  if (!/[a-z]/.test(password)) errors.push("يجب أن تحتوي على حرف صغير (a-z)");
  if (!/[0-9]/.test(password)) errors.push("يجب أن تحتوي على رقم واحد على الأقل");
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push("يجب أن تحتوي على رمز خاص (!@#$%^&*)");
  return { valid: errors.length === 0, errors };
}

export function normalizePhoneForWhatsApp(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("967")) return digits;
  if (digits.startsWith("00967")) return digits.slice(2);
  if (digits.length === 9 && digits.startsWith("7")) return `967${digits}`;
  return digits;
}

export interface CartOrderPayload {
  tenantName: string;
  currency: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  orderType: "delivery" | "pickup";
  deliveryAddress?: string;
  paymentMethod: "cash" | "wallet";
  walletName?: string;
  walletAccount?: string;
  transactionRef?: string;
  notes?: string;
}

export function formatInvoiceMessage(payload: CartOrderPayload): string {
  const lines: string[] = [
    `🧾 *طلب جديد من منيو ${payload.tenantName}*`,
    `━━━━━━━━━━━━━━━━━━`,
    ...payload.items.map(
      (it, i) =>
        `${i + 1}. ${it.name} × ${it.quantity} = ${formatPrice(
          it.price * it.quantity,
          payload.currency
        )}`
    ),
    `━━━━━━━━━━━━━━━━━━`,
    `💰 *الإجمالي:* ${formatPrice(payload.total, payload.currency)}`,
    `👤 *العميل:* ${payload.customerName}`,
    `📱 *الجوال:* ${payload.customerPhone}`,
    `🚚 *نوع الطلب:* ${
      payload.orderType === "delivery" ? "توصيل للموقع" : "استلام من الفرع"
    }`,
  ];

  if (payload.orderType === "delivery" && payload.deliveryAddress) {
    lines.push(`📍 *العنوان:* ${payload.deliveryAddress}`);
  }

  if (payload.paymentMethod === "wallet") {
    lines.push(
      `💳 *الدفع:* محفظة إلكترونية (${payload.walletName || "محفظة"})`,
      `🔢 *رقم العملية:* ${payload.transactionRef || "-"}`
    );
  } else {
    lines.push(`💵 *الدفع:* نقداً عند الاستلام`);
  }

  if (payload.notes?.trim()) {
    lines.push(`📝 *ملاحظات:* ${payload.notes.trim()}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`, `⚡ تم الطلب عبر منصة مينوز | MENUZ`);
  return lines.join("\n");
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string {
  const clean = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return clean
    ? `https://wa.me/${clean}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildSmsUrl(
  phone: string | null | undefined,
  message: string
): string {
  const clean = (phone || "").replace(/\s+/g, "");
  return `sms:${clean}?body=${encodeURIComponent(message)}`;
}
