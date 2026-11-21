"use client";

import Link from "next/link";
import { MapPin, Phone, ArrowUpLeft, Gift } from "lucide-react";
import { MenuzLogo, SamerzLogo } from "@/components/ui/brand-logo";

export function Footer() {
  return (
    <footer className="relative border-t border-navy-700/10 dark:border-white/10 bg-slate-100/70 dark:bg-[#030B1A] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-orange/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-5">
            <MenuzLogo height={48} />
            <p className="text-sm leading-relaxed text-navy-600 dark:text-slate-300 max-w-md">
              منصة <strong className="text-brand-orange">مينوز | MENUZ</strong>{" "}
              للمنيوهات الرقمية التفاعلية عبر رمز QR — صُممت لتمنح المطاعم
              والكافيهات والعربات تجربة طلب ذكية وسريعة تعكس فخامة علامتها.
            </p>
            <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 glass-card">
              <SamerzLogo size={36} />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  فكرة وتصميم وبرمجة
                </p>
                <p className="text-sm font-bold text-navy-700 dark:text-white">
                  شركة سامرز للحلول الذكية
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-sm font-bold text-navy-700 dark:text-white">
              روابط المنصة
            </h3>
            <ul className="space-y-2.5 text-sm text-navy-600 dark:text-slate-300">
              {[
                { href: "/", label: "الرئيسية" },
                { href: "/m/demo", label: "تجربة المنيو التجريبي" },
                { href: "/about", label: "من نحن" },
                { href: "/services", label: "الخدمات والمميزات" },
                { href: "/faq", label: "الأسئلة الشائعة" },
                { href: "/contact", label: "اتصل بنا واطلب الخدمة" },
                { href: "/login", label: "بوابة الإدارة" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center gap-1.5 hover:text-brand-orange transition"
                  >
                    <ArrowUpLeft className="w-3.5 h-3.5 text-brand-orange/70" />
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-sm font-bold text-navy-700 dark:text-white">
              تواصل معنا
            </h3>
            <div className="space-y-3 text-sm text-navy-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-orange shrink-0 mt-1" />
                <span>اليمن - صنعاء - شارع القيادة</span>
              </div>
              <a
                href="tel:776951100"
                className="flex items-center gap-2.5 hover:text-brand-orange transition"
              >
                <Phone className="w-4 h-4 text-brand-orange shrink-0" />
                <span dir="ltr" className="font-mono font-bold">
                  776951100
                </span>
              </a>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold bg-brand-orange/15 text-brand-orange border border-brand-orange/30">
              <Gift className="w-4 h-4 shrink-0" />
              <span>أول منيو مجاناً لمدة شهر</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-navy-700/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>
            فكرة وتصميم وبرمجة شركة سامرز للحلول الذكية 776951100 - جميع الحقوق
            محفوظة © 2027
          </p>
          <p className="tracking-widest font-semibold text-brand-orange">
            MENUZ v3.0 • SCAN • ORDER • ENJOY
          </p>
        </div>
      </div>
    </footer>
  );
}
