"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { cn, formatPrice } from "@/lib/utils";
import type { ResolvedTenantTheme } from "@/lib/theme-colors";

export interface CompletedOrderSummary {
  orderId: string | null;
  orderNumber: string;
  feedbackToken?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  computedTotal: number;
  currency: string;
  externalUrl: string;
  channel: "whatsapp" | "sms";
}

const RATING_FACES = [
  { value: 1, emoji: "😞", label: "سيئة" },
  { value: 2, emoji: "😕", label: "مقبولة" },
  { value: 3, emoji: "🙂", label: "جيدة" },
  { value: 4, emoji: "😊", label: "ممتازة" },
  { value: 5, emoji: "🤩", label: "رائعة" },
];

export function ThankYouFeedbackModal({
  tenantId,
  tenantName,
  themeColors,
  summary,
  onClose,
  onRestoreOrder,
  onToast,
}: {
  tenantId: string;
  tenantName: string;
  themeColors: ResolvedTenantTheme;
  summary: CompletedOrderSummary;
  onClose: () => void;
  onRestoreOrder: () => void;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const submitFeedback = async () => {
    if (!rating || sendingFeedback || !summary.orderId || !summary.feedbackToken) {
      return;
    }
    setSendingFeedback(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          orderId: summary.orderId,
          feedbackToken: summary.feedbackToken,
          rating,
          comment: comment.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedbackSent(true);
        onToast("شكراً لمشاركتنا رأيك!", "success");
      } else {
        onToast(data.error || "تعذر إرسال التقييم حالياً", "error");
      }
    } catch {
      onToast("تعذر الاتصال لإرسال التقييم", "error");
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border max-h-[92vh] overflow-y-auto space-y-5"
        style={{
          backgroundColor: themeColors.card,
          color: themeColors.text,
          borderColor: themeColors.border,
        }}
      >
        <div className="flex items-center justify-between">
          <MenuzLogo height={34} />
          <span
            className="text-xs font-mono font-bold px-3 py-1 rounded-full"
            style={{
              backgroundColor: themeColors.accentSoft,
              color: themeColors.accent,
            }}
          >
            #{summary.orderNumber}
          </span>
        </div>

        {/* Thank-you hero */}
        <div className="text-center space-y-2 py-2">
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: themeColors.accent,
              color: themeColors.buttonText,
            }}
          >
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black">
            بالعافية عليكم! 🍽️
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: themeColors.mutedText }}>
            تم تجهيز طلبك لدى <strong>{tenantName}</strong> بنجاح وتفريغ السلة.
          </p>
        </div>

        {/* Order Summary */}
        <div
          className="rounded-2xl p-4 border space-y-2 text-xs"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex items-center justify-between font-bold pb-1 border-b" style={{ borderColor: themeColors.border }}>
            <span>ملخص الطلب</span>
            <span style={{ color: themeColors.accent }}>
              {formatPrice(summary.computedTotal, summary.currency)}
            </span>
          </div>
          {summary.items.map((it, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="truncate">
                {it.name} × {it.quantity}
              </span>
              <span className="font-bold shrink-0">
                {formatPrice(it.line_total, summary.currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Re-open WhatsApp / SMS + Restore Order */}
        <div className="flex flex-wrap gap-2">
          <a
            href={summary.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[160px] rounded-xl py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border transition"
            style={{
              borderColor: themeColors.accent,
              color: themeColors.accent,
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>
              {summary.channel === "whatsapp"
                ? "فتح الفاتورة في واتساب"
                : "فتح الفاتورة في الرسائل"}
            </span>
          </a>

          <button
            type="button"
            onClick={onRestoreOrder}
            className="rounded-xl py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border transition"
            style={{ borderColor: themeColors.border }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة للسلة</span>
          </button>
        </div>

        {/* Optional Experience Rating (Admin-only, never shown to tenant) */}
        {summary.orderId && summary.feedbackToken && (
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />
              <span>كيف كانت تجربة الطلب؟ (اختياري)</span>
            </span>
          </div>

          {feedbackSent ? (
            <p className="text-xs font-bold text-emerald-500 text-center py-2">
              ✓ شكراً لتقييمك! مساهمتك تساعدنا في تطوير الخدمة.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {RATING_FACES.map((face) => {
                  const selected = rating === face.value;
                  return (
                    <button
                      key={face.value}
                      type="button"
                      onClick={() => setRating(face.value)}
                      className={cn(
                        "rounded-xl py-2 px-1 flex flex-col items-center gap-1 border text-[11px] font-bold transition",
                        selected ? "scale-105 shadow-md" : "opacity-80 hover:opacity-100"
                      )}
                      style={{
                        borderColor: selected ? themeColors.accent : themeColors.border,
                        backgroundColor: selected
                          ? themeColors.accentSoft
                          : "transparent",
                      }}
                    >
                      <span className="text-xl leading-none">{face.emoji}</span>
                      <span>{face.label}</span>
                    </button>
                  );
                })}
              </div>

              {rating !== null && (
                <div className="space-y-2 pt-1">
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ملاحظة قصيرة لإدارة منصة مينوز (اختياري)..."
                    className="w-full rounded-xl p-2.5 text-xs border bg-transparent focus:outline-none"
                    style={{ borderColor: themeColors.border }}
                  />
                  <button
                    type="button"
                    disabled={sendingFeedback}
                    onClick={submitFeedback}
                    className="w-full rounded-xl py-2 text-xs font-extrabold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                    style={{
                      backgroundColor: themeColors.accent,
                      color: themeColors.buttonText,
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingFeedback ? "جاري الإرسال..." : "إرسال التقييم"}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl py-3.5 text-sm font-extrabold transition hover:brightness-110"
          style={{
            backgroundColor: themeColors.accent,
            color: themeColors.buttonText,
          }}
        >
          العودة إلى المنيو
        </button>
      </motion.div>
    </motion.div>
  );
}
