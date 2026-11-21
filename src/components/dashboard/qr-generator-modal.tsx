"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, X, QrCode, ExternalLink } from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import type { Tenant } from "@/types/database";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function QrGeneratorModal({
  tenant,
  onClose,
}: {
  tenant: Tenant;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const [pngUrl, setPngUrl] = useState<string>("");
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  const menuUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${tenant.slug}`
      : `/m/${tenant.slug}`;

  useEffect(() => {
    let active = true;

    async function buildBrandQr() {
      try {
        // 1. High-res Canvas PNG with Center Tenant Logo + Small MENUZ Brand Footer
        const size = 1024;
        const padding = 64;
        const footerHeight = 140;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size + footerHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clean white card background with subtle navy border
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, menuUrl, {
          width: size - padding * 2,
          margin: 1,
          errorCorrectionLevel: "H",
          color: {
            dark: "#0B2D5B",
            light: "#FFFFFF",
          },
        });
        ctx.drawImage(qrCanvas, padding, padding);

        // Center circular badge for Tenant Logo (or initial)
        const centerX = size / 2;
        const centerY = size / 2;
        const badgeRadius = 96;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, badgeRadius + 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#FF7A00";
        ctx.stroke();
        ctx.restore();

        const tenantLogoSrc =
          tenant.logo_url || "/branding/menuz_mark_navy.png";
        try {
          const logoImg = await loadImg(tenantLogoSrc);
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, badgeRadius - 4, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            logoImg,
            centerX - badgeRadius + 4,
            centerY - badgeRadius + 4,
            (badgeRadius - 4) * 2,
            (badgeRadius - 4) * 2
          );
          ctx.restore();
        } catch {
          ctx.fillStyle = "#0B2D5B";
          ctx.font = "bold 72px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(tenant.name_ar.slice(0, 1), centerX, centerY);
        }

        // Bottom Brand Strip with small MENUZ logo + tenant name
        ctx.fillStyle = "#0B2D5B";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(tenant.name_ar, size - padding, size + 46);

        ctx.fillStyle = "#FF7A00";
        ctx.font = "bold 22px monospace";
        ctx.fillText(`/m/${tenant.slug}`, size - padding, size + 92);

        try {
          const menuzSmall = await loadImg("/branding/menuz1_logo.png");
          const h = 62;
          const w = Math.round(h * 1.63);
          ctx.drawImage(menuzSmall, padding, size + 36, w, h);
        } catch {
          // ignore logo load error
        }

        if (active) setPngUrl(canvas.toDataURL("image/png"));

        // 2. Vector SVG with embedded center badge + MENUZ mark
        const rawSvg = await QRCode.toString(menuUrl, {
          type: "svg",
          width: 512,
          margin: 2,
          errorCorrectionLevel: "H",
          color: {
            dark: "#0B2D5B",
            light: "#FFFFFF",
          },
        });
        const innerSvg = rawSvg
          .replace(/<svg[^>]*>/, "")
          .replace("</svg>", "");

        const composedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 580" width="512" height="580">
  <rect width="512" height="580" rx="24" fill="#FFFFFF"/>
  <g>${innerSvg}</g>
  <circle cx="256" cy="256" r="46" fill="#FFFFFF" stroke="#FF7A00" stroke-width="4"/>
  <text x="256" y="264" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#0B2D5B">${tenant.name_ar.slice(0, 1)}</text>
  <text x="256" y="534" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="#0B2D5B">${tenant.name_ar} • MENUZ</text>
  <text x="256" y="558" text-anchor="middle" font-family="monospace" font-size="12" fill="#FF7A00">${menuUrl}</text>
</svg>`;
        if (active) setSvgMarkup(composedSvg);
      } catch {
        // Fallback plain QR if needed
      }
    }

    buildBrandQr();
    return () => {
      active = false;
    };
  }, [menuUrl, tenant.logo_url, tenant.name_ar, tenant.slug]);

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `menuz-${tenant.slug}-qr.png`;
    a.click();
    toast("تم تحميل رمز QR الاحترافي بصيغة PNG", "success");
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menuz-${tenant.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast("تم تحميل رمز QR بصيغة SVG", "success");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(menuUrl);
    toast("تم نسخ رابط المنيو", "success");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full rounded-3xl p-6 glass-panel bg-white dark:bg-[#071A38] space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-brand-orange" />
            <h3 className="font-extrabold text-lg">
              رمز QR — {tenant.name_ar}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-3xl p-5 bg-white flex flex-col items-center gap-2.5 border border-navy-700/10 shadow-inner">
          {pngUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pngUrl}
              alt={`QR ${tenant.name_ar}`}
              className="w-60 h-auto object-contain rounded-xl"
            />
          ) : (
            <div className="w-60 h-64 animate-pulse bg-slate-200 rounded-2xl" />
          )}
          <p className="text-[11px] font-bold text-navy-700">
            شعار الجهة في المنتصف + هوية مينوز للطباعة المباشرة
          </p>
          <p
            dir="ltr"
            className="text-[11px] font-mono text-slate-500 break-all"
          >
            {menuUrl}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={downloadPng}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110"
          >
            <Download className="w-4 h-4" />
            <span>تحميل PNG</span>
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold border border-navy-700/20 dark:border-white/20 hover:border-brand-orange"
          >
            <Download className="w-4 h-4 text-brand-orange" />
            <span>تحميل SVG</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold bg-slate-100 dark:bg-navy-900/70"
          >
            <Copy className="w-3.5 h-3.5 text-brand-orange" />
            <span>نسخ الرابط</span>
          </button>
          <a
            href={`/m/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold bg-slate-100 dark:bg-navy-900/70"
          >
            <ExternalLink className="w-3.5 h-3.5 text-brand-orange" />
            <span>معاينة المنيو</span>
          </a>
        </div>
      </div>
    </div>
  );
}
