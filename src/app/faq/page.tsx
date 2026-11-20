"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "كيف أطلب إنشاء منيو رقمي لمطعمي أو مقهاي على منصة مينوز؟",
    a: "تواصل مع إدارة النظام عبر صفحة «اتصل بنا» أو على الرقم 776951100، وسنقوم بتجهيز صفحة مطعمك وهويته اللونية وإضافة القائمة الأولى وتزويدك ببيانات الدخول ورمز QR جاهز للطباعة.",
  },
  {
    q: "هل يحتاج الزبون إلى تحميل تطبيق لفتح المنيو؟",
    a: "لا أبداً! بمجرد مسح رمز الـ QR بكاميرا الجوال يُفتح المنيو فوراً في المتصفح خلال ثوانٍ، كما يمكن لمن يرغب تثبيته كتطبيق خفيف (PWA) على الشاشة الرئيسية.",
  },
  {
    q: "كيف تصلني طلبات العملاء؟",
    a: "عند إتمام العميل اختيار أصنافه من السلة، يقوم النظام بتجهيز فاتورة منسقة تحتوي على الأصناف والكميات والإجمالي والعنوان وطريقة الدفع (نقدي أو محفظة إلكترونية مع رقم العملية)، ويرسلها مباشرة إلى رقم الواتساب الخاص بك أو رسالة SMS.",
  },
  {
    q: "هل أستطيع تعديل الأسعار أو إخفاء صنف نفدت كميته بنفسي؟",
    a: "نعم، من خلال لوحة التحكم الخاصة بك (/dashboard) يمكنك تعديل الأسعار، إضافة أصناف جديدة، رفع الصور، تغيير حالة التوفر (متوفر / غير متوفر)، وجدولة العروض في أي وقت ومن أي جهاز.",
  },
  {
    q: "ما هي المحافظ الإلكترونية المدعومة؟",
    a: "المنصة مرنة وتدعم إضافة أي محفظة إلكترونية تستخدمها في اليمن (مثل جيب، جوالي، ون كاش، فلوسك، كاش، موبايل موني...) مع إظهار رقم الحساب وزر نسخ مباشر للعميل.",
  },
  {
    q: "هل بيانات مطعمي معزولة وآمنة عن بقية المشتركين؟",
    a: "بالتأكيد. كل جهة تعمل ضمن بيئة معزولة بالكامل على مستوى قاعدة البيانات عبر سياسات Row Level Security (RLS)، ولا يمكن لأي مطعم الاطلاع على بيانات أو إحصائيات مطعم آخر.",
  },
];

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>الأسئلة الشائعة</span>
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black">
              إجابات واضحة حول{" "}
              <span className="text-gradient-orange">مينوز | MENUZ</span>
            </h1>
          </div>

          <div className="space-y-4">
            {faqs.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "rounded-2xl glass-panel overflow-hidden transition-colors",
                    isOpen && "border-brand-orange/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between gap-4 text-right font-bold text-base sm:text-lg"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-brand-orange shrink-0 transition-transform duration-300",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 pt-1 text-sm sm:text-base leading-relaxed text-navy-600 dark:text-slate-300 border-t border-navy-700/10 dark:border-white/10">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl p-8 glass-panel text-center space-y-4">
            <h2 className="text-xl font-extrabold">لديك سؤال آخر؟</h2>
            <p className="text-sm text-navy-600 dark:text-slate-300">
              فريق سامرز للحلول الذكية جاهز للرد على استفساراتك في أي وقت.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
            >
              <span>تواصل معنا الآن</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
