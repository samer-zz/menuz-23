"use client";

import Image from "next/image";
import { useApp } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function MenuzLogo({
  forceTheme,
  className,
  height = 42,
}: {
  forceTheme?: "dark" | "light";
  className?: string;
  height?: number;
}) {
  const { theme } = useApp();
  const mode = forceTheme || theme;
  const src =
    mode === "dark"
      ? "/branding/menuz2_logo.png"
      : "/branding/menuz1_logo.png";

  return (
    <Image
      src={src}
      alt="مينوز | MENUZ"
      width={Math.round(height * 1.63)}
      height={height}
      priority
      className={cn("object-contain select-none", className)}
    />
  );
}

export function MenuzMonogram({
  forceTheme,
  size = 44,
  className,
}: {
  forceTheme?: "dark" | "light";
  size?: number;
  className?: string;
}) {
  const { theme } = useApp();
  const mode = forceTheme || theme;
  const src =
    mode === "dark"
      ? "/branding/menuz_mark_white.png"
      : "/branding/menuz_mark_navy.png";

  return (
    <Image
      src={src}
      alt="MENUZ Icon"
      width={size}
      height={Math.round(size * 1.45)}
      className={cn("object-contain select-none", className)}
    />
  );
}

export function SamerzLogo({
  size = 44,
  className,
  forceLightOnDark = false,
}: {
  size?: number;
  className?: string;
  forceLightOnDark?: boolean;
}) {
  return (
    <Image
      src="/branding/samerz_logo.png"
      alt="شركة سامرز للحلول الذكية"
      width={size}
      height={Math.round(size * 0.875)}
      className={cn(
        "object-contain select-none",
        forceLightOnDark ? "" : "dark:invert-0 invert",
        className
      )}
    />
  );
}

/**
 * Geometric visual signature derived from the MENUZ folded-menu Z-QR emblem.
 */
export function MenuzGeometricAccent({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 220"
      fill="none"
      className={cn("pointer-events-none select-none opacity-25", className)}
    >
      <defs>
        <linearGradient id="menuzAccentGrad" x1="0" y1="0" x2="220" y2="220">
          <stop offset="0%" stopColor="#FF9E2C" stopOpacity="0.65" />
          <stop offset="55%" stopColor="#FF7A00" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0B2D5B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M36 42H172L52 178H184"
        stroke="url(#menuzAccentGrad)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="148"
        y="24"
        width="36"
        height="36"
        rx="10"
        stroke="#FF7A00"
        strokeOpacity="0.45"
        strokeWidth="3"
      />
      <rect
        x="36"
        y="160"
        width="24"
        height="24"
        rx="7"
        fill="#FF7A00"
        fillOpacity="0.2"
      />
    </svg>
  );
}
