"use client";

import React, { useState } from "react";
import { MapPin, Phone, Send, CheckCircle2, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useApp } from "@/components/providers/theme-provider";
import { buildWhatsAppUrl } from "@/lib/utils";

export default function ContactPage() {
  const { toast } = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          business_name: businessName,
          message,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "تعذر إرسال الطلب", "error");
      } else {
        setSent(true);
        setName("");
        setPhone("");
        setBusinessName("");
        setMessage("");
        toast("تم استلام طلبك بنجاح، سنتواصل معك قريباً!", "success");
      }
    } catch {
      toast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  const waSupport = buildWhatsAppUrl(
    "967776951100",
    "مرحباً، أرغب بالاشتراك أو الاستفسار عن منصة مينوز (MENUZ)."
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
              اتصل بنا
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black">
              ابدأ رحلتك مع{" "}
              <span className="text-gradient-orange">مينوز | MENUZ</span>
            </h1>
            <p className="text-base text-navy-600 dark:text-slate-300">
              أرسل طلب تفعيل الخدمة أو استفسارك، وسيقوم فريق شركة سامرز للحلول
              الذكية بالتواصل معك مباشرة.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Info Cards */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-3xl p-7 glass-panel space-y-5">
                <h2 className="text-xl font-extrabold">معلومات التواصل المباشر</h2>

                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-brand-orange" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      المقر الرئيسي
                    </p>
                    <p className="font-bold mt-0.5">اليمن - صنعاء - شارع القيادة</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-brand-orange" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      مدير النظام وطلب الخدمة
                    </p>
                    <a
                      href="tel:776951100"
                      dir="ltr"
                      className="font-mono font-bold text-lg text-brand-orange hover:underline block mt-0.5"
                    >
                      776951100
                    </a>
                  </div>
                </div>

                <a
                  href={waSupport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>تواصل سريع عبر واتساب</span>
                </a>
              </div>
            </div>

            {/* Real Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl p-7 sm:p-9 glass-panel">
                {sent ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-extrabold">
                      تم إرسال طلبك بنجاح!
                    </h3>
                    <p className="text-sm text-navy-600 dark:text-slate-300 max-w-md mx-auto">
                      حفظنا رسالتك في النظام، وسيتواصل معك فريق سامرز للحلول
                      الذكية في أقرب وقت.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSent(false)}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold border border-navy-700/20 dark:border-white/15"
                    >
                      إرسال رسالة أخرى
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="contact-website">Website</label>
                      <input
                        id="contact-website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                    <h2 className="text-xl font-extrabold mb-1">
                      نموذج طلب الخدمة والاستفسار
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          الاسم الكامل *
                        </label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="مثال: أحمد محمد"
                          className="w-full rounded-xl px-4 py-3 text-sm bg-slate-100/80 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          رقم الجوال / الواتساب *
                        </label>
                        <input
                          required
                          dir="ltr"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="77xxxxxxx"
                          className="w-full rounded-xl px-4 py-3 text-sm text-right bg-slate-100/80 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        اسم المطعم / الكافيه / المشروع (اختياري)
                      </label>
                      <input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="مثال: مطعم ومقهى ..."
                        className="w-full rounded-xl px-4 py-3 text-sm bg-slate-100/80 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        تفاصيل الطلب *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="اكتب نبذة عن منشأتك أو استفسارك..."
                        className="w-full rounded-xl px-4 py-3 text-sm bg-slate-100/80 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 disabled:opacity-60 transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>{loading ? "جاري الإرسال..." : "إرسال الطلب"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
