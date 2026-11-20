"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MENUZ Application Error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 menuz-grid-bg">
      <div className="max-w-lg w-full rounded-3xl p-8 text-center space-y-6 glass-panel">
        <div className="flex justify-center">
          <MenuzLogo height={48} />
        </div>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        <div className="space-y-2">
          <p className="text-4xl font-black text-rose-500">500</p>
          <h1 className="text-2xl font-extrabold">حدث خطأ غير متوقع</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
            واجه النظام مشكلة مؤقتة أثناء معالجة طلبك. يمكنك إعادة المحاولة الآن أو
            العودة إلى الرئيسية.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold border border-navy-700/20 dark:border-white/15"
          >
            <Home className="w-4 h-4 text-brand-orange" />
            <span>الرئيسية</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
