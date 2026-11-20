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
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/branding/samerz_logo.png"
      alt="شركة سامرز للحلول الذكية"
      width={size}
      height={Math.round(size * 0.875)}
      className={cn(
        "object-contain select-none dark:invert-0 invert",
        className
      )}
    />
  );
}
