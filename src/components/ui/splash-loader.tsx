"use client";

import { motion } from "framer-motion";
import { MenuzLogo } from "./brand-logo";

export function SplashLoader({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 p-8">
      <motion.div
        animate={{ scale: [0.97, 1.03, 0.97], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="p-5 rounded-3xl glass-panel"
      >
        <MenuzLogo height={56} />
      </motion.div>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
        <span className="w-2 h-2 rounded-full bg-brand-orange animate-ping" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-52 rounded-3xl bg-slate-200 dark:bg-navy-800/80" />
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 w-24 rounded-full bg-slate-200 dark:bg-navy-800/80 shrink-0"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-slate-200 dark:bg-navy-800/70"
          />
        ))}
      </div>
    </div>
  );
}
