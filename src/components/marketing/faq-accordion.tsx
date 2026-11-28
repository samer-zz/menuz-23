"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqEntry {
  q: string;
  a: string;
}

export function FaqAccordion({ faqs }: { faqs: FaqEntry[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {faqs.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={item.q}
            className={cn(
              "rounded-2xl glass-panel overflow-hidden transition-colors",
              isOpen && "border-brand-orange/50"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full px-6 py-5 flex items-center justify-between gap-4 text-right font-bold text-base sm:text-lg"
            >
              <span>{item.q}</span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-brand-orange shrink-0 transition-transform duration-300",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 pt-1 text-sm sm:text-base leading-relaxed text-navy-600 dark:text-slate-300 border-t border-navy-700/10 dark:border-white/10">
                    {item.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
