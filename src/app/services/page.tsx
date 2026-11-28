import Link from "next/link";
import {
  QrCode,
  ShoppingCart,
  Wallet,
  BarChart3,
  Clock,
  Smartphone,
  Shield,
  ImagePlus,
  ArrowLeft,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الخدمات والمميزات",
  description:
    "اكتشف باقة الخدمات الذكية التي تقدمها منصة مينوز MENUZ للمطاعم والكافيهات — القائمة الرقمية الذكية.. لتجربة فريدة.",
  openGraph: {
    title: "الخدمات والمميزات | مينوز MENUZ",
    description:
      "امسح.. اطلب.. واستمتع — كل ما تحتاجه لإدارة منيو رقمي عصري ومربح.",
    images: [{ url: "/branding/menuz_brand_showcase.png", width: 1200, height: 800 }],
  },
};

const services = [
  {
    icon: QrCode,
    title: "منيو رقمي عبر QR مخصص",
    desc: "رابط مستقل وهوية لونية خاصة بكل مطعم، مع مولد QR عالي الدقة قابل للتحميل بصيغتي PNG وSVG للطباعة على الطاولات والعبوات.",
  },
  {
    icon: ShoppingCart,
    title: "سلة طلبات وفاتورة واتساب احترافية",
    desc: "يختار الزبون أصنافه وكمياته، يحدد التوصيل أو الاستلام، وتُنشأ فاتورة عربية منسقة تُرسل مباشرة عبر واتساب أو رسالة نصية.",
  },
  {
    icon: Wallet,
    title: "تكامل المحافظ الإلكترونية المحلية",
    desc: "اعرض محافظك الإلكترونية (جيب، جوالي، ون كاش، فلوسك...) مع زر نسخ رقم الحساب وخانة لإدخال رقم العملية في الفاتورة.",
  },
  {
    icon: Clock,
    title: "جدولة العروض التلقائية",
    desc: "أنشئ عروضاً موسمية أو يومية بتاريخ بداية ونهاية، لتظهر بشريط العروض المتحرك وتختفي تلقائياً فور انتهاء المدة.",
  },
  {
    icon: ImagePlus,
    title: "ضغط تلقائي لصور الأصناف",
    desc: "عند رفع صور الوجبات من لوحة التحكم، يتم ضغطها تلقائياً قبل الرفع للحفاظ على سرعة التصفح وتوفير المساحة السحابية.",
  },
  {
    icon: BarChart3,
    title: "إحصائيات وتقارير ذكية",
    desc: "تتبع مسحات اليوم والأسبوع والشهر، أكثر الأصناف مشاهدة، وأوقات الذروة لمساعدتك في اتخاذ قرارات تسويقية أدق.",
  },
  {
    icon: Smartphone,
    title: "تطبيق ويب تقدمي (PWA) ويعمل أوفلاين",
    desc: "إمكانية تثبيت المنصة والمنيو على شاشة الجوال كتطبيق، مع تخزين مؤقت ذكي للصور والنصوص الأساسية عند ضعف الشبكة.",
  },
  {
    icon: Shield,
    title: "عزل كامل وصلاحيات دقيقة",
    desc: "لوحة خاصة لصاحب المنشأة لإدارة المنيو والأسعار والعروض دون المساس بهوية المنصة، ولوحة مركزية للإدارة العليا.",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
              خدماتنا المتكاملة
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black">
              كل ما تحتاجه لإدارة منيو{" "}
              <span className="text-gradient-orange">عصري ومربح</span>
            </h1>
            <p className="text-base sm:text-lg text-navy-600 dark:text-slate-300">
              مجموعة أدوات هندسية وتسويقية مترابطة تمنحك السيطرة الكاملة على
              تجربة عملائك.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-3xl p-6 glass-card hover:border-brand-orange/50 hover:-translate-y-1 flex flex-col gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
                  <s.icon className="w-6 h-6 text-brand-orange" />
                </div>
                <h2 className="text-lg font-extrabold">{s.title}</h2>
                <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
            >
              <span>ابدأ بتفعيل منيو منشأتك الآن</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
