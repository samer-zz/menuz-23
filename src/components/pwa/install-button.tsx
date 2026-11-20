"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "solid" | "subtle";
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
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

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast("تم تثبيت تطبيق مينوز بنجاح!", "success");
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIos) {
      toast(
        "لتثبيت التطبيق على iPhone: اضغط على زر المشاركة ⬆️ ثم اختر «إضافة إلى الشاشة الرئيسية»",
        "info"
      );
      return;
    }

    toast(
      "يمكنك تثبيت التطبيق من قائمة المتصفح عبر خيار «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية»",
      "info"
    );
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
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
      <span>تثبيت التطبيق</span>
    </button>
  );
}
