"use client";

import React, { useState } from "react";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { useApp } from "@/components/providers/theme-provider";
import { validateStrongPassword } from "@/lib/utils";

export function PasswordChangeCard({
  mustChangePassword,
  onSuccess,
}: {
  mustChangePassword?: boolean;
  onSuccess?: () => void;
}) {
  const { toast } = useApp();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = [
    { label: "8 أحرف على الأقل", ok: newPassword.length >= 8 },
    { label: "حرف كبير (A-Z)", ok: /[A-Z]/.test(newPassword) },
    { label: "حرف صغير (a-z)", ok: /[a-z]/.test(newPassword) },
    { label: "رقم واحد على الأقل", ok: /[0-9]/.test(newPassword) },
    { label: "رمز خاص (!@#$%)", ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateStrongPassword(newPassword);
    if (!validation.valid) {
      toast(validation.errors[0], "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("كلمتا المرور غير متطابقتين", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "تعذر تغيير كلمة المرور", "error");
      } else {
        setNewPassword("");
        setConfirmPassword("");
        toast("تم تحديث كلمة المرور بنجاح!", "success");
        onSuccess?.();
      }
    } catch {
      toast("حدث خطأ أثناء الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl p-6 glass-panel space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <h3 className="font-extrabold text-lg">تغيير كلمة المرور</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mustChangePassword
              ? "⚠️ يرجى تغيير كلمة المرور الأولية فوراً لحماية حسابك."
              : "اختر كلمة مرور قوية لحماية لوحة التحكم."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold">كلمة المرور الجديدة</label>
          <input
            type="password"
            dir="ltr"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold">تأكيد كلمة المرور</label>
          <input
            type="password"
            dir="ltr"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm text-right bg-slate-100 dark:bg-navy-900 border border-navy-700/15 dark:border-white/15"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {checks.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2 text-xs font-medium"
            >
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className={c.ok ? "text-emerald-500" : "text-slate-400"}>
                {c.label}
              </span>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-6 py-3 text-sm font-bold bg-orange-gradient text-white shadow-orange-glow hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "جاري التحديث..." : "حفظ كلمة المرور الجديدة"}
        </button>
      </form>
    </div>
  );
}
