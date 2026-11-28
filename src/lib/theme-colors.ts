import type { Tenant } from "@/types/database";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface ResolvedTenantTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  mutedText: string;
  border: string;
  buttonText: string;
  primaryButtonText: string;
  accentSoft: string;
  primarySoft: string;
}

export function normalizeHexColor(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return HEX_RE.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickReadableTextColor(
  bgHex: string,
  preferredHex?: string | null
): string {
  if (preferredHex && HEX_RE.test(preferredHex.trim())) {
    const candidate = preferredHex.trim().toUpperCase();
    if (contrastRatio(bgHex, candidate) >= 4.5) {
      return candidate;
    }
  }
  const whiteContrast = contrastRatio(bgHex, "#FFFFFF");
  const darkContrast = contrastRatio(bgHex, "#0F172A");
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#0F172A";
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Mixes a hex color with black/white cleanly to derive harmonious surface/card shades
 * so each tenant menu genuinely reflects its own brand colors rather than hardcoded defaults.
 */
export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  const r = Math.round(a.r * (1 - w) + b.r * w);
  const g = Math.round(a.g * (1 - w) + b.g * w);
  const bl = Math.round(a.b * (1 - w) + b.b * w);
  return (
    "#" +
    [r, g, bl]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function resolveTenantTheme(
  tenant: Pick<
    Tenant,
    | "primary_color"
    | "accent_color"
    | "background_color"
    | "card_color"
    | "text_color"
    | "button_text_color"
  >,
  mode: "dark" | "light"
): ResolvedTenantTheme {
  const primary = normalizeHexColor(tenant.primary_color, "#1E293B");
  const accent = normalizeHexColor(tenant.accent_color, "#EA580C");

  const defaultBg =
    mode === "dark" ? mixHex(primary, "#050914", 0.78) : "#F8FAFC";
  const background = normalizeHexColor(tenant.background_color, defaultBg);

  const isBgDark = relativeLuminance(background) < 0.35;
  const defaultCard = isBgDark
    ? mixHex(primary, "#0F172A", 0.55)
    : "#FFFFFF";
  const card = normalizeHexColor(tenant.card_color, defaultCard);
  const surface = isBgDark ? mixHex(card, "#FFFFFF", 0.05) : mixHex(card, primary, 0.03);

  const text = pickReadableTextColor(background, tenant.text_color);
  const mutedText =
    relativeLuminance(background) < 0.35 ? "#CBD5E1" : "#475569";

  const border = isBgDark
    ? hexWithAlpha("#FFFFFF", 0.12)
    : hexWithAlpha(primary, 0.14);

  const buttonText = pickReadableTextColor(accent, tenant.button_text_color);
  const primaryButtonText = pickReadableTextColor(primary, null);

  return {
    primary,
    accent,
    background,
    surface,
    card,
    text,
    mutedText,
    border,
    buttonText,
    primaryButtonText,
    accentSoft: hexWithAlpha(accent, isBgDark ? 0.18 : 0.12),
    primarySoft: hexWithAlpha(primary, isBgDark ? 0.25 : 0.08),
  };
}
