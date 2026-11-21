"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  Sun,
  Moon,
  LogIn,
  Globe,
  Sparkles,
  Eye,
} from "lucide-react";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { useApp } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "من نحن" },
  { href: "/services", label: "الخدمات" },
  { href: "/faq", label: "الأسئلة الشائعة" },
  { href: "/contact", label: "اتصل بنا" },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme, toast } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-700/10 dark:border-white/10 bg-white/80 dark:bg-[#040E21]/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <MenuzLogo
            height={44}
            className="transition-transform group-hover:scale-[1.03]"
          />
        </Link>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-1.5 rounded-2xl p-1.5 bg-slate-100/80 dark:bg-navy-800/70 border border-navy-700/10 dark:border-white/10">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
                  active
                    ? "text-white"
                    : "text-navy-700/80 dark:text-slate-300 hover:text-navy-700 dark:hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-orange-gradient shadow-orange-glow -z-10"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              toast(
                "الواجهة حالياً باللغة العربية — سيتم دعم لغات إضافية في التحديث القادم",
                "info"
              )
            }
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-navy-700/15 dark:border-white/15 bg-white/70 dark:bg-white/5 text-navy-700 dark:text-slate-200 hover:border-brand-orange/50 transition"
            title="اللغة"
          >
            <Globe className="w-3.5 h-3.5 text-brand-orange" />
            <span>AR</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-navy-700/15 dark:border-white/15 bg-white/70 dark:bg-white/5 text-navy-700 dark:text-slate-200 hover:border-brand-orange/50 transition"
            aria-label="تبديل الوضع الليلي والنهاري"
            title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-brand-amber" />
            ) : (
              <Moon className="w-4 h-4 text-navy-700" />
            )}
          </button>

          <Link
            href="/m/demo"
            className="hidden md:inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold border border-brand-orange/35 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition"
          >
            <Eye className="w-4 h-4" />
            <span>المنيو التجريبي</span>
          </Link>

          <Link
            href="/contact"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>اطلب الخدمة</span>
          </Link>

          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold border border-navy-700/20 dark:border-white/15 hover:border-brand-orange/60 text-navy-700 dark:text-white transition"
            title="تسجيل دخول الإدارة"
          >
            <LogIn className="w-4 h-4 text-brand-orange" />
            <span className="hidden xl:inline">دخول</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2.5 rounded-xl border border-navy-700/15 dark:border-white/15 bg-white/70 dark:bg-white/5"
            aria-label="القائمة"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-navy-700/10 dark:border-white/10 bg-white/95 dark:bg-[#040E21]/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block px-4 py-3 rounded-xl text-sm font-bold transition",
                      active
                        ? "bg-orange-gradient text-white shadow-orange-glow"
                        : "text-navy-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="pt-3 flex flex-wrap items-center gap-2 border-t border-navy-700/10 dark:border-white/10">
                <Link
                  href="/m/demo"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                >
                  <Eye className="w-4 h-4" />
                  <span>المنيو التجريبي</span>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-navy-700/20 dark:border-white/15"
                >
                  <LogIn className="w-4 h-4 text-brand-orange" />
                  <span>دخول الإدارة</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
