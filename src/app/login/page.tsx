"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ArrowRight,
  Phone,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { useApp } from "@/components/providers/theme-provider";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme, toast } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "فشل تسجيل الدخول");
        toast(data.error || "فشل تسجيل الدخول", "error");
        return;
      }

      toast("تم تسجيل الدخول بنجاح!", "success");
      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم، يرجى المحاولة مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-8 menuz-grid-bg relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-[-10%] w-[480px] h-[480px] rounded-full bg-brand-orange/15 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 left-[-10%] w-[480px] h-[480px] rounded-full bg-navy-600/30 blur-[130px]" />

      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold glass-panel hover:border-brand-orange/50 transition"
        >
          <ArrowRight className="w-4 h-4 text-brand-orange" />
          <span>العودة للرئيسية</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl glass-panel hover:border-brand-orange/50 transition"
          aria-label="تبديل المظهر"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-brand-amber" />
          ) : (
            <Moon className="w-4 h-4 text-navy-700" />
          )}
        </button>
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="max-w-md w-full mx-auto my-8 rounded-[2rem] p-7 sm:p-9 glass-panel relative z-10 space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <MenuzLogo height={52} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/25">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بوابة الإدارة الآمنة</span>
          </div>
          <h1 className="font-display text-2xl font-black">تسجيل الدخول</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            أدخل بيانات حسابك للوصول إلى لوحة تحكم منيو منشأتك
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-2xl p-3.5 text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@menuz.app"
                className="w-full rounded-xl pr-10 pl-4 py-3 text-sm text-right bg-slate-100/90 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPass ? "text" : "password"}
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl pr-10 pl-10 py-3 text-sm text-right bg-slate-100/90 dark:bg-navy-900/80 border border-navy-700/15 dark:border-white/15 focus:outline-none focus:border-brand-orange"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-orange"
                aria-label="إظهار أو إخفاء كلمة المرور"
              >
                {showPass ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 disabled:opacity-60 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? "جاري التحقق..." : "دخول إلى لوحة التحكم"}</span>
          </button>
        </form>

        {/* Required Notice */}
        <div className="rounded-2xl p-4 bg-navy-700/10 dark:bg-white/5 border border-navy-700/10 dark:border-white/10 text-center space-y-1.5">
          <p className="text-xs leading-relaxed text-navy-700 dark:text-slate-200 font-semibold">
            لطلب إنشاء حساب أو طلب الخدمة تواصل مع مدير النظام:{" "}
            <a
              href="tel:776951100"
              dir="ltr"
              className="text-brand-orange font-mono font-extrabold hover:underline inline-flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              776951100
            </a>
          </p>
        </div>
      </motion.div>

      <div className="text-center text-xs text-slate-500 dark:text-slate-400 relative z-10">
        © {new Date().getFullYear()} مينوز | MENUZ — شركة سامرز للحلول الذكية
      </div>
    </main>
  );
}
