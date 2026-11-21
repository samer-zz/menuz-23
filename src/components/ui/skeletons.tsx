"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function CardSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-4 glass-panel animate-pulse flex items-center gap-4"
        >
          <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-navy-800 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-2/3 rounded-lg bg-slate-200 dark:bg-navy-800" />
            <div className="h-3 w-full rounded-lg bg-slate-200/80 dark:bg-navy-800/70" />
            <div className="h-4 w-1/3 rounded-lg bg-brand-orange/25" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-10 text-center glass-panel space-y-3.5 relative overflow-hidden",
        className
      )}
    >
      <div className="pointer-events-none absolute -top-12 -left-12 w-36 h-36 rounded-full bg-brand-orange/10 blur-2xl" />
      <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center relative">
        <Icon className="w-7 h-7 text-brand-orange" />
      </div>
      <h3 className="font-display text-lg font-black">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}
