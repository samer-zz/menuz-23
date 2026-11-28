"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap,
  LayoutDashboard,
  RefreshCw,
  BarChart3,
  QrCode,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Wallet,
  MessageCircle,
  CheckCircle2,
  Gift,
  LayoutGrid,
  List,
  Bell,
  Play,
  Loader2,
  Plus,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  MenuzGeometricAccent,
  MenuzLogo,
  MenuzMonogram,
  SamerzLogo,
} from "@/components/ui/brand-logo";
import { useApp } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: i * 0.08,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const whyFeatures = [
  {
    icon: Zap,
    title: "سرعة فائقة وتصفح سلس",
    desc: "فتح فوري للمنيو عند مسح QR في أقل من ثانية، مع تحميل كسول ذكي للصور ودعم العمل كتطبيق مستقل على الهاتف.",
  },
  {
    icon: LayoutDashboard,
    title: "لوحة تحكم مستقرة وسهلة",
    desc: "إدارة الأقسام والأصناف والأسعار والعروض المجدولة والإشعارات الفورية من أي جوال أو حاسوب بواجهة عربية احترافية.",
  },
  {
    icon: RefreshCw,
    title: "تحديثات وإشعارات لحظية",
    desc: "عدّل الأسعار أو أرسل إشعار عرض حي داخل المنيو ليصل لضيوفك فوراً دون إعادة تحميل الصفحة.",
  },
  {
    icon: BarChart3,
    title: "تحليلات ذكية ومؤشرات أداء",
    desc: "تعرّف على عدد المسحات اليومية والأسبوعية والشهرية، الأصناف الأكثر طلباً ومشاهدة، وأوقات الذروة.",
  },
  {
    icon: Wallet,
    title: "محافظ إلكترونية وفواتير واتساب",
    desc: "سلة طلبات منزلقة مع عداد حي، دعم الدفع النقدي أو المحافظ الإلكترونية، وإرسال فاتورة منسقة عبر واتساب.",
  },
  {
    icon: ShieldCheck,
    title: "عزل أمني صارم وأداء فائق",
    desc: "بنية متعددة الجهات بعزل تام لبيانات كل مطعم، حماية متقدمة لتسجيل الدخول، وضغط ذكي للصور قبل الرفع.",
  },
];

const workflowSteps = [
  {
    step: "01",
    icon: QrCode,
    title: "امسح رمز الـ QR",
    desc: "يمسح العميل الرمز المطبوع على الطاولة أو العبوة، أو يثبّت منيو مطعمك مباشرة على هاتفه.",
  },
  {
    step: "02",
    icon: ShoppingBag,
    title: "تصفح واطلب بكل راحة",
    desc: "يستعرض الأصناف بالعرض المفضل لديه (بطاقات، قائمة، أو كلاسيكي) ويضيف طلباته للسلة مع اختيار الدفع.",
  },
  {
    step: "03",
    icon: MessageCircle,
    title: "استقبل الفاتورة فوراً",
    desc: "تصلك فاتورة الطلب مرتبة بالكامل عبر الواتساب أو الرسائل النصية جاهزة للتنفيذ والتوصيل.",
  },
];

const interactivePreviewItems = [
  { name: "برجر سماش دبل", cat: "وجبات سريعة", price: 1800, badge: "🔥 الأكثر طلباً" },
  { name: "آيس سبانيش لاتيه", cat: "مشروبات", price: 1100, badge: "🆕 جديد" },
  { name: "تشيز كيك توت بري", cat: "حلويات", price: 1400, badge: "⭐ مميز" },
];

export function LandingView() {
  const router = useRouter();
  const { toast } = useApp();
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [previewMode, setPreviewMode] = useState<"cards" | "list">("cards");
  const [previewCartCount, setPreviewCartCount] = useState(1);

  const handleOpenDemo = async () => {
    setCreatingDemo(true);
    try {
      const res = await fetch("/api/demo/ensure", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        toast("جاري فتح المنيو التجريبي التفاعلي...", "success");
        router.push(data.url);
        return;
      }
      router.push("/m/demo");
    } catch {
      router.push("/m/demo");
    } finally {
      setCreatingDemo(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 menuz-grid-bg">
          {/* Ambient Brand Glows + Logo-Inspired Geometric Accent */}
          <div className="pointer-events-none absolute -top-32 right-[-10%] w-[540px] h-[540px] rounded-full bg-brand-orange/15 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-0 left-[-10%] w-[520px] h-[520px] rounded-full bg-navy-600/30 blur-[140px]" />
          <MenuzGeometricAccent className="hidden lg:block absolute top-8 left-8 w-56 h-56" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Hero Text */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="lg:col-span-7 space-y-6"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 glass-panel text-xs sm:text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                    <span className="text-navy-700 dark:text-slate-200">
                      شركة سامرز للحلول الذكية
                    </span>
                    <span className="text-brand-orange font-bold">•</span>
                    <span className="text-brand-orange font-black">MENUZ v3.0</span>
                  </div>

                  {/* Free Trial 1-Month Offer Badge */}
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 dark:text-emerald-300 text-xs sm:text-sm font-extrabold">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>أول منيو مجاناً لمدة شهر</span>
                  </div>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.16] tracking-tight text-navy-700 dark:text-white">
                  حوّل قائمة مطعمك إلى{" "}
                  <span className="text-gradient-orange">تجربة رقمية فاخرة</span>
                </h1>

                <p className="text-base sm:text-lg text-navy-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  منصة <strong className="text-brand-orange">مينوز | MENUZ</strong>{" "}
                  تمنح مطعمك أو مقهاك منيو تفاعلياً فائق السرعة عبر رمز QR، مع
                  تثبيت كتطبيق مستقل لكل مطعم، إشعارات فورية حية، سلة طلبات ذكية،
                  وفواتير واتساب احترافية.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenDemo}
                    disabled={creatingDemo}
                    className="inline-flex items-center gap-2.5 rounded-2xl px-7 py-4 text-base font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition-all disabled:opacity-70"
                  >
                    {creatingDemo ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    <span>عرض المنيو التجريبي</span>
                  </button>

                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-bold glass-panel hover:border-brand-orange/60 transition"
                  >
                    <Sparkles className="w-5 h-5 text-brand-orange" />
                    <span>اطلب الخدمة لمنشأتك</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>

                <div className="pt-3 flex flex-wrap items-center gap-5 text-xs sm:text-sm text-navy-600 dark:text-slate-300">
                  {[
                    "أول منيو مجاناً لمدة شهر",
                    "تثبيت PWA مباشر لكل مطعم",
                    "إشعارات وعروض فورية",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Hero Live Interactive Phone Showcase */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-5"
              >
                <div className="relative mx-auto max-w-[420px]">
                  <div className="absolute -inset-4 rounded-[2.8rem] bg-gradient-to-tr from-brand-orange/35 via-navy-500/20 to-brand-amber/20 blur-2xl" />

                  <div className="relative rounded-[2.4rem] p-5 border border-white/15 bg-gradient-to-b from-[#0B2D5B] to-[#040E21] text-white shadow-2xl space-y-4 overflow-hidden">
                    <div className="pointer-events-none absolute -top-10 -left-10 w-36 h-36 rounded-full bg-brand-orange/15 blur-2xl" />

                    {/* Simulated Top Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <MenuzLogo forceTheme="dark" height={32} />
                      <div className="flex items-center gap-1.5">
                        <span className="p-1.5 rounded-lg bg-white/10 relative">
                          <Bell className="w-3.5 h-3.5 text-brand-amber" />
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-orange" />
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-orange/20 text-brand-amber border border-brand-orange/30">
                          معاينة تفاعلية
                        </span>
                      </div>
                    </div>

                    {/* Interactive Mode Switcher inside Preview */}
                    <div className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/5 border border-white/10">
                      <span className="text-[11px] font-bold text-slate-300">
                        جرّب تبديل العرض:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMode("cards")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition",
                            previewMode === "cards"
                              ? "bg-orange-gradient text-white"
                              : "text-slate-300 hover:bg-white/10"
                          )}
                        >
                          <LayoutGrid className="w-3 h-3" />
                          <span>بطاقات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode("list")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition",
                            previewMode === "list"
                              ? "bg-orange-gradient text-white"
                              : "text-slate-300 hover:bg-white/10"
                          )}
                        >
                          <List className="w-3 h-3" />
                          <span>قائمة</span>
                        </button>
                      </div>
                    </div>

                    {/* Simulated Menu Items */}
                    <div
                      className={cn(
                        "grid gap-2.5",
                        previewMode === "cards" ? "grid-cols-1" : "grid-cols-1"
                      )}
                    >
                      {interactivePreviewItems.map((item) => (
                        <div
                          key={item.name}
                          className={cn(
                            "rounded-2xl bg-white/[0.06] border border-white/10 hover:border-brand-orange/40 transition flex items-center justify-between gap-3",
                            previewMode === "cards" ? "p-3" : "px-3 py-2"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-orange/20 text-brand-amber font-bold">
                                {item.badge}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.cat}
                              </span>
                            </div>
                            <p className="font-extrabold text-sm mt-1 truncate">
                              {item.name}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-black text-xs text-brand-amber">
                              {item.price.toLocaleString()} ر.ي
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewCartCount((c) => c + 1)
                              }
                              className="w-7 h-7 rounded-xl bg-orange-gradient text-white flex items-center justify-center hover:scale-105 transition"
                              aria-label={`إضافة ${item.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Simulated Live Cart Footer */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleOpenDemo}
                        className="flex-1 rounded-2xl px-4 py-3 bg-orange-gradient text-white text-xs font-extrabold flex items-center justify-between shadow-orange-glow hover:brightness-110 transition"
                      >
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-white/20 font-black">
                            {previewCartCount}
                          </span>
                          <span>افتح المنيو التجريبي الكامل</span>
                        </span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FREE TRIAL SPOTLIGHT BANNER */}
        <section className="py-6 border-y border-navy-700/10 dark:border-white/10 bg-gradient-to-l from-brand-orange/15 via-navy-700/10 to-brand-orange/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-orange-gradient text-white flex items-center justify-center shadow-orange-glow shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="font-display font-black text-base sm:text-lg">
                  عرض الانطلاق: أول منيو مجاناً لمدة شهر كامل
                </p>
                <p className="text-xs sm:text-sm text-navy-600 dark:text-slate-300">
                  انقل منشأتك إلى مينوز v3.0 وجرّب لوحة التحكم والتحليلات بدون
                  أي التزام مالي لأول 30 يوماً.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
            >
              احصل على شهرك المجاني
            </Link>
          </div>
        </section>

        {/* WHY MENUZ SECTION */}
        <section className="py-20 lg:py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="text-center max-w-2xl mx-auto space-y-3 mb-14"
            >
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
                لماذا مينوز؟
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-navy-700 dark:text-white">
                منصة صُممت بمقاييس عالمية لنجاح مطعمك
              </h2>
              <p className="text-sm sm:text-base text-navy-600 dark:text-slate-300">
                كل تفصيل في مينوز مصمم لرفع مبيعاتك وتقليل وقت الانتظار ومنح
                ضيوفك انطباعاً عصرياً لا يُنسى.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whyFeatures.map((feat, idx) => (
                <motion.div
                  key={feat.title}
                  custom={idx}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  className="group rounded-3xl p-7 glass-card hover:border-brand-orange/50 hover:-translate-y-1 menuz-fold-pattern"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center mb-5 group-hover:bg-orange-gradient group-hover:text-white transition-all">
                    <feat.icon className="w-6 h-6 text-brand-orange group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-extrabold mb-2 text-navy-700 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                    {feat.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW STEPS */}
        <section className="py-20 bg-slate-100/70 dark:bg-[#071A38]/40 border-y border-navy-700/10 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
                كيف تعمل المنصة؟
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-navy-700 dark:text-white">
                امسح .. اطلب .. واستمتع في 3 خطوات
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {workflowSteps.map((s, idx) => (
                <motion.div
                  key={s.step}
                  custom={idx}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="relative rounded-3xl p-7 glass-panel overflow-hidden"
                >
                  <span className="absolute top-5 left-6 text-5xl font-black text-brand-orange/15 select-none">
                    {s.step}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-orange-gradient text-white flex items-center justify-center shadow-orange-glow mb-5">
                    <s.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-extrabold mb-2">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                    {s.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SAMERZ SMART SOLUTIONS SECTION */}
        <section className="py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2.2rem] p-8 sm:p-12 glass-panel relative overflow-hidden">
              <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brand-orange/15 blur-3xl" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative">
                <div className="lg:col-span-8 space-y-5">
                  <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 bg-navy-700/10 dark:bg-white/5 border border-navy-700/10 dark:border-white/10">
                    <SamerzLogo size={38} />
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        الشركة المطوّرة
                      </p>
                      <p className="text-sm font-extrabold">
                        شركة سامرز للحلول الذكية | SAMERZ
                      </p>
                    </div>
                  </div>

                  <h2 className="font-display text-2xl sm:text-4xl font-black leading-snug">
                    نبني أنظمة سحابية ذكية تواكب طموح قطاع الضيافة والمطاعم
                  </h2>
                  <p className="text-sm sm:text-base leading-relaxed text-navy-600 dark:text-slate-300 max-w-3xl">
                    تلتزم <strong>شركة سامرز للحلول الذكية</strong> بتقديم حلول
                    برمجية موثوقة تجمع بين الهندسة الدقيقة، الأمان العالي، وجمال
                    التجربة البصرية. رؤيتنا هي تمكين المطاعم والمشاريع التجارية
                    في اليمن والمنطقة من التحول الرقمي بتكلفة ذكية وجودة تضاهي
                    المنصات العالمية.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href="/about"
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold bg-navy-700 text-white hover:bg-navy-600 transition"
                    >
                      <span>اقرأ المزيد عن سامرز</span>
                      <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
                    >
                      <span>احجز عرضاً توضيحياً</span>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-4 flex justify-center">
                  <div className="relative p-8 rounded-3xl bg-brand-gradient border border-white/10 flex flex-col items-center gap-4 text-center shadow-2xl">
                    <MenuzMonogram forceTheme="dark" size={72} />
                    <p className="text-white font-extrabold text-lg">
                      جاهز للانطلاق خلال ساعات
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      نقوم بإعداد هويتك وأقسامك وأصنافك وتسليمك حساب الإدارة ورمز
                      الـ QR جاهزاً للطباعة، مع شهرك الأول مجاناً.
                    </p>
                    <a
                      href="tel:776951100"
                      dir="ltr"
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-brand-amber font-mono font-bold text-sm hover:bg-white/15 transition"
                    >
                      📞 776951100
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
