"use client";

import React, { useMemo } from "react";
import { Eye, QrCode, ShoppingBag, Clock, Flame, Building2 } from "lucide-react";
import type { AnalyticsEvent, MenuItem, Tenant } from "@/types/database";

export function AnalyticsCharts({
  events,
  items,
  tenants,
}: {
  events: AnalyticsEvent[];
  items: MenuItem[];
  tenants?: Tenant[];
}) {
  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let scansToday = 0;
    let scansWeek = 0;
    let scansMonth = 0;
    let totalOrders = 0;
    const hours = new Array<number>(24).fill(0);
    const tenantScans = new Map<string, number>();

    for (const ev of events) {
      const ts = new Date(ev.created_at).getTime();
      if (ev.event_type === "menu_scan") {
        if (ts >= dayAgo) scansToday++;
        if (ts >= weekAgo) scansWeek++;
        if (ts >= monthAgo) scansMonth++;
        const hour = new Date(ev.created_at).getHours();
        hours[hour]++;
        tenantScans.set(ev.tenant_id, (tenantScans.get(ev.tenant_id) || 0) + 1);
      } else if (ev.event_type === "order_submit") {
        totalOrders++;
      }
    }

    const maxHour = Math.max(1, ...hours);
    const topItems = [...items]
      .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
      .slice(0, 6);

    const tenantComparison = (tenants || [])
      .map((t) => ({
        id: t.id,
        name: t.name_ar,
        scans: tenantScans.get(t.id) || 0,
      }))
      .sort((a, b) => b.scans - a.scans);

    return {
      scansToday,
      scansWeek,
      scansMonth,
      totalOrders,
      hours,
      maxHour,
      topItems,
      tenantComparison,
    };
  }, [events, items, tenants]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "مسحات اليوم",
            value: stats.scansToday,
            icon: QrCode,
            sub: "آخر 24 ساعة",
          },
          {
            label: "مسحات الأسبوع",
            value: stats.scansWeek,
            icon: Clock,
            sub: "آخر 7 أيام",
          },
          {
            label: "مسحات الشهر",
            value: stats.scansMonth,
            icon: Eye,
            sub: "آخر 30 يوماً",
          },
          {
            label: "الطلبات المرسلة",
            value: stats.totalOrders,
            icon: ShoppingBag,
            sub: "واتساب / SMS",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-5 glass-panel space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {kpi.label}
              </span>
              <kpi.icon className="w-4 h-4 text-brand-orange" />
            </div>
            <p className="text-3xl font-black text-navy-700 dark:text-white">
              {kpi.value.toLocaleString("en-US")}
            </p>
            <p className="text-[11px] text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Peak Hours Chart */}
        <div className="lg:col-span-7 rounded-3xl p-6 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange" />
              <span>أوقات الذروة (توزيع المسحات على 24 ساعة)</span>
            </h3>
          </div>

          <div className="h-44 flex items-end gap-1 pt-4">
            {stats.hours.map((cnt, h) => {
              const pct = Math.max(6, Math.round((cnt / stats.maxHour) * 100));
              return (
                <div
                  key={h}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                  title={`الساعة ${h}:00 — ${cnt} مسحة`}
                >
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full rounded-t-md bg-gradient-to-t from-navy-600 to-brand-orange opacity-80 group-hover:opacity-100 transition-all"
                    />
                  </div>
                  {h % 4 === 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {h}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Viewed Items */}
        <div className="lg:col-span-5 rounded-3xl p-6 glass-panel space-y-4">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-brand-orange" />
            <span>الأصناف الأكثر مشاهدة</span>
          </h3>

          {stats.topItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              لا توجد مشاهدات مسجلة بعد.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.topItems.map((it) => {
                const maxV = Math.max(1, stats.topItems[0]?.views_count || 1);
                const w = Math.max(8, Math.round((it.views_count / maxV) * 100));
                return (
                  <div key={it.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="truncate">{it.name}</span>
                      <span className="text-brand-orange font-mono">
                        {it.views_count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-900 overflow-hidden">
                      <div
                        style={{ width: `${w}%` }}
                        className="h-full rounded-full bg-orange-gradient"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Tenant Performance Comparison */}
      {tenants && tenants.length > 0 && (
        <div className="rounded-3xl p-6 glass-panel space-y-4">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-orange" />
            <span>مقارنة أداء الجهات (عدد مسحات الـ QR)</span>
          </h3>
          <div className="space-y-3">
            {stats.tenantComparison.map((row) => {
              const maxS = Math.max(
                1,
                ...stats.tenantComparison.map((x) => x.scans)
              );
              const pct = Math.max(
                row.scans > 0 ? 10 : 3,
                Math.round((row.scans / maxS) * 100)
              );
              return (
                <div key={row.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{row.name}</span>
                    <span className="font-mono text-brand-orange">
                      {row.scans} مسحة
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 dark:bg-navy-900 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-orange-gradient"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
