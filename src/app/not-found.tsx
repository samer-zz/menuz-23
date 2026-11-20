import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 menuz-grid-bg">
      <div className="max-w-lg w-full rounded-3xl p-8 sm:p-10 text-center space-y-6 glass-panel">
        <div className="flex justify-center">
          <MenuzLogo height={50} />
        </div>
        <div className="w-20 h-20 mx-auto rounded-3xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
          <SearchX className="w-10 h-10 text-brand-orange" />
        </div>
        <div className="space-y-2">
          <p className="text-5xl font-black text-gradient-orange">404</p>
          <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
            عذراً، لم نتمكن من العثور على الصفحة أو رابط المنيو المطلوب. تأكد من
            صحة الرابط أو عد إلى الصفحة الرئيسية.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
          >
            <Home className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold border border-navy-700/20 dark:border-white/15 hover:border-brand-orange/60 transition"
          >
            <span>تواصل معنا</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
