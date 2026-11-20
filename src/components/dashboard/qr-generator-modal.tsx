"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, X, QrCode, ExternalLink } from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import type { Tenant } from "@/types/database";

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
    QRCode.toDataURL(menuUrl, {
      width: 1024,
      margin: 2,
      color: {
        dark: "#0B2D5B",
        light: "#FFFFFF",
      },
    })
      .then(setPngUrl)
      .catch(() => {});

    QRCode.toString(menuUrl, {
      type: "svg",
      width: 512,
      margin: 2,
      color: {
        dark: "#0B2D5B",
        light: "#FFFFFF",
      },
    })
      .then(setSvgMarkup)
      .catch(() => {});
  }, [menuUrl]);

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `menuz-${tenant.slug}-qr.png`;
    a.click();
    toast("تم تحميل رمز QR بصيغة PNG", "success");
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

        <div className="rounded-3xl p-6 bg-white flex flex-col items-center gap-3 border border-navy-700/10">
          {pngUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pngUrl}
              alt={`QR ${tenant.name_ar}`}
              className="w-56 h-56 object-contain"
            />
          ) : (
            <div className="w-56 h-56 animate-pulse bg-slate-200 rounded-2xl" />
          )}
          <p className="text-xs font-extrabold text-navy-700">
            امسح لفتح منيو {tenant.name_ar}
          </p>
          <p dir="ltr" className="text-[11px] font-mono text-slate-500 break-all">
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
