"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, CheckCircle2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/components/providers/theme-provider";
import { MenuzLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton({
  className,
  variant = "outline",
  appTitle,
  label = "تثبيت التطبيق",
}: {
  className?: string;
  variant?: "outline" | "solid" | "subtle";
  appTitle?: string;
  label?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useApp();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error Safari standalone flag
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isInstalled) return null;

  const triggerNativeInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast("تم تثبيت التطبيق بنجاح على جهازك!", "success");
        setIsInstalled(true);
        setModalOpen(false);
      }
      setDeferredPrompt(null);
      return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer",
          variant === "solid" &&
            "bg-orange-gradient text-white shadow-orange-glow hover:brightness-110",
          variant === "outline" &&
            "border border-navy-700/20 dark:border-white/15 bg-white/70 dark:bg-white/5 hover:border-brand-orange/60 text-navy-700 dark:text-white",
          variant === "subtle" &&
            "text-navy-600 dark:text-slate-300 hover:text-brand-orange dark:hover:text-brand-orange bg-transparent",
          className
        )}
      >
        {isIos ? (
          <Smartphone className="w-4 h-4 text-brand-orange" />
        ) : (
          <Download className="w-4 h-4 text-brand-orange" />
        )}
        <span>{label}</span>
      </button>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 glass-panel bg-white dark:bg-[#071A38] text-navy-700 dark:text-white space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <MenuzLogo height={34} />
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تطبيق ويب متقدم (PWA)</span>
                </div>
                <h3 className="font-display text-xl font-black">
                  {appTitle
                    ? `ثبّت منيو «${appTitle}» على شاشتك`
                    : "ثبّت تطبيق مينوز على جهازك"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
                  يُفتح التطبيق مباشرة على نفس هذه الصفحة بملء الشاشة وبسرعة
                  فائقة حتى مع ضعف الاتصال.
                </p>
              </div>

              <div className="rounded-2xl p-4 bg-slate-100/90 dark:bg-navy-900/75 border border-navy-700/10 dark:border-white/10 space-y-2.5 text-xs">
                {deferredPrompt ? (
                  <div className="flex items-center gap-2 text-emerald-500 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>جهازك جاهز للتثبيت المباشر بنقرة واحدة!</span>
                  </div>
                ) : isIos ? (
                  <>
                    <p className="font-bold text-brand-orange flex items-center gap-1.5">
                      <Share className="w-4 h-4" />
                      <span>خطوات التثبيت على iPhone / Safari:</span>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                      <li>اضغط على أيقونة المشاركة (Share) أسفل المتصفح.</li>
                      <li>مرّر واختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</li>
                      <li>اضغط «إضافة» وسيُفتح المنيو كتطبيق مستقل.</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-brand-orange">
                      خطوات التثبيت على المتصفح:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                      <li>افتح قائمة المتصفح (⋮) في الزاوية العلوية.</li>
                      <li>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>
                      <li>عند فتح التطبيق مستقبلاً سيفتح مباشرة على هذا المسار.</li>
                    </ol>
                  </>
                )}
              </div>

              <div className="flex gap-2.5">
                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={triggerNativeInstall}
                    className="flex-1 rounded-xl py-3 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 transition"
                  >
                    تثبيت الآن
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 rounded-xl py-3 text-sm font-extrabold bg-orange-gradient text-white shadow-orange-glow"
                  >
                    فهمت، شكراً
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
