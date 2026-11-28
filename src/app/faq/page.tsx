import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FaqAccordion, type FaqEntry } from "@/components/marketing/faq-accordion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة",
  description:
    "إجابات واضحة حول منصة مينوز (MENUZ) للقوائم الرقمية الذكية، طريقة التفعيل، استقبال الطلبات، والمحافظ الإلكترونية.",
  openGraph: {
    title: "الأسئلة الشائعة | مينوز MENUZ",
    description:
      "كل ما تريد معرفته حول تفعيل وإدارة المنيو الرقمي عبر منصة مينوز.",
    images: [{ url: "/branding/menuz_brand_showcase.png", width: 1200, height: 800 }],
  },
};

const faqs: FaqEntry[] = [
  {
    q: "كيف أطلب إنشاء منيو رقمي لمطعمي أو مقهاي على منصة مينوز؟",
    a: "تواصل مع إدارة النظام عبر صفحة «اتصل بنا» أو على الرقم 776951100، وسنقوم بتجهيز صفحة مطعمك وهويته اللونية وإضافة القائمة الأولى وتزويدك ببيانات الدخول ورمز QR جاهز للطباعة.",
  },
  {
    q: "هل يحتاج الزبون إلى تحميل تطبيق لفتح المنيو؟",
    a: "لا أبداً! بمجرد مسح رمز الـ QR بكاميرا الجوال يُفتح المنيو فوراً في المتصفح خلال ثوانٍ، كما يمكن لمن يرغب تثبيته كتطبيق خفيف على الشاشة الرئيسية.",
  },
  {
    q: "كيف تصلني طلبات العملاء؟",
    a: "عند إتمام العميل اختيار أصنافه من السلة، يقوم النظام بتجهيز فاتورة منسقة تحتوي على الأصناف والكميات والإجمالي والعنوان وطريقة الدفع (نقدي أو محفظة إلكترونية مع رقم العملية)، ويرسلها مباشرة إلى رقم الواتساب الخاص بك أو رسالة نصية.",
  },
  {
    q: "هل أستطيع تعديل الأسعار أو إخفاء صنف نفدت كميته بنفسي؟",
    a: "نعم، من خلال لوحة التحكم الخاصة بك يمكنك تعديل الأسعار، إضافة أصناف جديدة، رفع الصور، تغيير حالة التوفر (متوفر / غير متوفر)، وجدولة العروض في أي وقت ومن أي جهاز.",
  },
  {
    q: "ما هي المحافظ الإلكترونية المدعومة؟",
    a: "المنصة مرنة وتدعم إضافة أي محفظة إلكترونية تستخدمها في اليمن (مثل جيب، جوالي، ون كاش، فلوسك، كاش، موبايل موني...) مع إظهار رقم الحساب وزر نسخ مباشر للعميل.",
  },
  {
    q: "هل بيانات مطعمي معزولة وآمنة عن بقية المشتركين؟",
    a: "بالتأكيد. كل جهة تعمل ضمن بيئة معزولة بالكامل بصلاحيات صارمة على مستوى الخادم وقاعدة البيانات، ولا يمكن لأي مطعم الاطلاع على بيانات أو إحصائيات مطعم آخر.",
  },
];

export default function FaqPage() {
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

          <FaqAccordion faqs={faqs} />

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
