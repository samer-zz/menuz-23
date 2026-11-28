import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ContactView } from "@/components/marketing/contact-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "اتصل بنا واطلب الخدمة",
  description:
    "تواصل مع فريق مينوز (MENUZ) وشركة سامرز للحلول الذكية لتفعيل المنيو الرقمي لمطعمك أو مقهاك.",
  openGraph: {
    title: "اتصل بنا | مينوز MENUZ",
    description:
      "احصل على منيو رقمي ذكي بهوية مطعمك الخاصة مع شهر تجريبي مجاني.",
    images: [{ url: "/branding/menuz_brand_showcase.png", width: 1200, height: 800 }],
  },
};

export default function ContactPage() {
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

          <ContactView />
        </div>
      </main>
      <Footer />
    </div>
  );
}
