"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Zap,
  LayoutDashboard,
  RefreshCw,
  BarChart3,
  QrCode,
  ShoppingBag,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ArrowLeft,
  Wallet,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MenuzLogo, MenuzMonogram, SamerzLogo } from "@/components/ui/brand-logo";
import { PwaInstallButton } from "@/components/pwa/install-button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const whyFeatures = [
  {
    icon: Zap,
    title: "سرعة فائقة وتصفح سلس",
    desc: "فتح فوري للمنيو عند مسح QR في أقل من ثانية، مع تحميل كسول ذكي للصور ودعم العمل دون اتصال (PWA).",
  },
  {
    icon: LayoutDashboard,
    title: "لوحة تحكم مستقرة وسهلة",
    desc: "إدارة الأقسام والأصناف والأسعار والعروض المجدولة من أي جوال أو حاسوب بواجهة عربية احترافية.",
  },
  {
    icon: RefreshCw,
    title: "تحديثات لحظية فورية",
    desc: "عدّل الأسعار أو أوقف صنفاً غير متوفر أو أطلق عرضاً محدوداً في ثوانٍ ليظهر فوراً لكل العملاء.",
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
    title: "عزل أمني صارم وأداء سحابي",
    desc: "بنية متعددة الجهات محمية بسياسات Row Level Security وتشفير كامل للبيانات وصلاحيات دقيقة.",
  },
];

const workflowSteps = [
  {
    step: "01",
    icon: QrCode,
    title: "امسح رمز الـ QR",
    desc: "يمسح العميل الرمز المطبوع على الطاولة أو العبوة دون الحاجة لتحميل أي تطبيق إضافي.",
  },
  {
    step: "02",
    icon: ShoppingBag,
    title: "تصفح واطلب بكل راحة",
    desc: "يستعرض الأصناف والصور والعروض المميزة، ويضيف طلباته للسلة مع اختيار الدفع المناسب.",
  },
  {
    step: "03",
    icon: MessageCircle,
    title: "استقبل الفاتورة فوراً",
    desc: "تصلك فاتورة الطلب مرتبة بالكامل عبر الواتساب أو الرسائل النصية جاهزة للتنفيذ والتوصيل.",
  },
];

export function LandingView() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 menuz-grid-bg">
          {/* Ambient Brand Glows */}
          <div className="pointer-events-none absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-brand-orange/15 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-0 left-[-10%] w-[520px] h-[520px] rounded-full bg-navy-600/30 blur-[140px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Hero Text */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="lg:col-span-7 space-y-7"
              >
                <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 glass-panel text-xs sm:text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                  <span className="text-navy-700 dark:text-slate-200">
                    من تطوير شركة سامرز للحلول الذكية
                  </span>
                  <span className="text-brand-orange font-bold">•</span>
                  <span className="text-brand-orange font-bold">MENUZ v2.0</span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.18] tracking-tight text-navy-700 dark:text-white">
                  حوّل قائمة مطعمك إلى{" "}
                  <span className="text-gradient-orange">تجربة رقمية فاخرة</span>
                </h1>

                <p className="text-base sm:text-lg text-navy-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  منصة <strong className="text-brand-orange">مينوز | MENUZ</strong>{" "}
                  تمنح مطعمك أو مقهاك منيو تفاعلياً فائق السرعة عبر رمز QR، مع
                  سلة طلبات ذكية، دعم المحافظ الإلكترونية، إرسال الفواتير عبر
                  الواتساب، ولوحة تحكم سحابية متكاملة.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2.5 rounded-2xl px-7 py-4 text-base font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>اطلب الخدمة لمنشأتك</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/services"
                    className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-bold glass-panel hover:border-brand-orange/60 transition"
                  >
                    <span>استكشف المميزات</span>
                  </Link>

                  <PwaInstallButton
                    variant="outline"
                    className="py-4 px-5 rounded-2xl"
                  />
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-6 text-xs sm:text-sm text-navy-600 dark:text-slate-300">
                  {[
                    "دعم عربي RTL متكامل",
                    "يعمل كتطبيق جوال PWA",
                    "تحديثات لحظية بدون طباعة",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Hero Interactive Showcase Frame */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-5"
              >
                <div className="relative mx-auto max-w-[420px]">
                  {/* Outer glow ring */}
                  <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-tr from-brand-orange/30 via-navy-500/20 to-brand-amber/20 blur-2xl" />

                  <div className="relative rounded-[2.2rem] p-5 glass-panel border border-white/15 bg-gradient-to-b from-[#0B2D5B]/95 to-[#040E21]/95 text-white shadow-2xl">
                    {/* Top simulated notch & header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                      <MenuzLogo forceTheme="dark" height={36} />
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-brand-orange/20 text-brand-amber border border-brand-orange/30">
                        امسح .. اطلب .. واستمتع
                      </span>
                    </div>

                    {/* Brand showcase preview */}
                    <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-[#040E21]">
                      <Image
                        src="/branding/menuz_brand_showcase.png"
                        alt="عرض هوية منصة مينوز العصرية"
                        width={600}
                        height={400}
                        priority
                        className="w-full h-auto object-cover"
                      />
                    </div>

                    {/* Feature chips inside preview */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                      {[
                        { icon: Smartphone, text: "تصميم متجاوب للجوال" },
                        { icon: QrCode, text: "توليد QR فوري" },
                        { icon: Wallet, text: "محافظ إلكترونية" },
                        { icon: BarChart3, text: "إحصائيات دقيقة" },
                      ].map((chip) => (
                        <div
                          key={chip.text}
                          className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white/5 border border-white/10"
                        >
                          <chip.icon className="w-4 h-4 text-brand-orange shrink-0" />
                          <span className="font-medium text-slate-200">
                            {chip.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
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
                  className="group rounded-3xl p-7 glass-card hover:border-brand-orange/50 hover:-translate-y-1"
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
                      الـ QR جاهزاً للطباعة.
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
