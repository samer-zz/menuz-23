import Link from "next/link";
import { ShieldCheck, Cpu, Sparkles, MapPin, Phone, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SamerzLogo, MenuzLogo } from "@/components/ui/brand-logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "من نحن",
  description:
    "تعرف على منصة مينوز (MENUZ) وشركة سامرز للحلول الذكية في صنعاء - اليمن.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
              عن المنصة والشركة
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black">
              منصة <span className="text-gradient-orange">مينوز | MENUZ</span>{" "}
              من شركة سامرز للحلول الذكية
            </h1>
            <p className="text-base sm:text-lg text-navy-600 dark:text-slate-300 leading-relaxed">
              نطوّر حلولاً رقمية متكاملة ترتقي بتجربة المطاعم والكافيهات وعربات
              الطعام من القوائم الورقية التقليدية إلى منصات تفاعلية ذكية وسريعة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-3xl p-8 glass-panel space-y-4">
              <MenuzLogo height={46} />
              <h2 className="text-2xl font-extrabold">رسالة مينوز</h2>
              <p className="text-sm sm:text-base leading-relaxed text-navy-600 dark:text-slate-300">
                تمكين كل مطعم ومشروع غذائي — من العربات المتنقلة حتى السلاسل
                الكبرى — من امتلاك منيو رقمي فاخر وسريع يعكس هويته الخاصة،
                ويتيح للعملاء الطلب بضغطة زر والدفع بالمحافظ الإلكترونية أو
                نقداً بكل سلاسة.
              </p>
            </div>

            <div className="rounded-3xl p-8 glass-panel space-y-4">
              <div className="flex items-center gap-3">
                <SamerzLogo size={46} />
                <div>
                  <h2 className="text-2xl font-extrabold">
                    شركة سامرز للحلول الذكية
                  </h2>
                  <p className="text-xs text-brand-orange font-bold">
                    SAMERZ SMART SOLUTIONS
                  </p>
                </div>
              </div>
              <p className="text-sm sm:text-base leading-relaxed text-navy-600 dark:text-slate-300">
                فريق هندسي وتصميمي متخصص في بناء المنتجات السحابية الآمنة،
                واجهات المستخدم الحديثة، وأنظمة التجارة والضيافة الرقمية
                المتوافقة مع البيئة المحلية واحتياجات السوق اليمني والإقليمي.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: "تصميم عالمي المستوى",
                desc: "نهتم بأدق تفاصيل الحركة والخطوط العربية والتباين البصري لمنح الزائر راحة وفخامة حقيقية.",
              },
              {
                icon: Cpu,
                title: "أداء سحابي فائق الموثوقية",
                desc: "بنية سحابية حديثة مصممة لفتح القوائم في أجزاء من الثانية واستيعاب أوقات الذروة بكفاءة عالية واستقرار دائم.",
              },
              {
                icon: ShieldCheck,
                title: "أمان وخصوصية تامة",
                desc: "عزل كامل لبيانات كل منشأة عن الأخرى مع تشفير شامل للجلسات وصلاحيات محكمة لحماية أعمالك.",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-3xl p-7 glass-card space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-brand-orange" />
                </div>
                <h3 className="text-lg font-extrabold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl p-8 glass-panel flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-brand-orange">
                <MapPin className="w-4 h-4" />
                <span>اليمن - صنعاء - شارع القيادة</span>
              </div>
              <h3 className="text-2xl font-extrabold">
                هل ترغب بإطلاق منيو منشأتك اليوم؟
              </h3>
              <p className="text-sm text-navy-600 dark:text-slate-300">
                تواصل معنا مباشرة على الرقم <strong dir="ltr">776951100</strong>{" "}
                أو أرسل طلبك عبر نموذج الاتصال.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="tel:776951100"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold border border-navy-700/20 dark:border-white/15"
              >
                <Phone className="w-4 h-4 text-brand-orange" />
                <span dir="ltr">776951100</span>
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
              >
                <span>اطلب الخدمة</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
