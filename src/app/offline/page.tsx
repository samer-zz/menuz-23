"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 menuz-grid-bg">
      <div className="max-w-md w-full rounded-3xl p-8 text-center space-y-6 glass-panel">
        <div className="flex justify-center">
          <MenuzLogo height={52} />
        </div>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-brand-orange" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">أنت غير متصل بالإنترنت</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
            تعذر الاتصال بالشبكة حالياً. الصفحات التي قمت بزيارتها مسبقاً تبقى
            متاحة، ويمكنك إعادة المحاولة فور عودة الاتصال.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold border border-navy-700/20 dark:border-white/15"
          >
            <Home className="w-4 h-4 text-brand-orange" />
            <span>الرئيسية</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
