import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const tenantA = "11111111-1111-4111-8111-111111111111";
const itemA1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemUnavailable = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const insertedOrders = [];
const recordedEvents = [];

function createMockAdminSupabase() {
  return {
    rpc: async (fnName, params) => {
      if (fnName === "check_api_rate_limit") {
        return { data: true, error: null };
      }
      if (fnName === "record_menu_event") {
        recordedEvents.push({ fnName, params });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    from: (table) => {
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: tenantA,
                  name_ar: "مطعم اختبار",
                  currency: "ر.ي",
                  is_active: true,
                  has_delivery: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "menu_items") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_col, ids) => {
                const catalog = [
                  {
                    id: itemA1,
                    name: "شاورما دجاج",
                    price: 1350,
                    is_available: true,
                    badges: [],
                  },
                  {
                    id: itemUnavailable,
                    name: "عصير نادر",
                    price: 500,
                    is_available: false,
                    badges: ["unavailable"],
                  },
                ];
                return {
                  data: catalog.filter((c) => ids.includes(c.id)),
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: (_col, idemKey) => ({
                maybeSingle: async () => {
                  const found = insertedOrders.find(
                    (o) => o.idempotency_key === idemKey
                  );
                  return { data: found ?? null, error: null };
                },
              }),
            }),
          }),
          insert: (row) => {
            const record = { id: `order-${insertedOrders.length + 1}`, ...row };
            insertedOrders.push(record);
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
              }),
            };
          },
        };
      }
      return {
        insert: async () => ({ error: null }),
      };
    },
  };
}

globalThis.__menuzOrdersMockAdmin = createMockAdminSupabase;

const loaderCode = `
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = ${JSON.stringify(rootDir)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase/admin") {
    return { shortCircuit: true, url: "data:text/javascript,export function createAdminSupabase() { return globalThis.__menuzOrdersMockAdmin(); }" };
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const candidates = [
      path.join(root, "src", rel + ".ts"),
      path.join(root, "src", rel + ".tsx"),
      path.join(root, "src", rel, "index.ts"),
    ];
    const fs = await import("node:fs");
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return nextResolve(pathToFileURL(c).href, context);
      }
    }
  }
  if (specifier === "next/server") {
    return nextResolve(pathToFileURL(path.join(root, "node_modules/next/server.js")).href, context);
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loaderCode)}`, import.meta.url);

async function makeJsonReq(url, body) {
  const { NextRequest } = await import("next/server");
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://menuz-23.vercel.app",
      host: "menuz-23.vercel.app",
      "x-forwarded-for": "203.0.113.25",
    },
    body: JSON.stringify(body),
  });
}

test("Stage 10 Orders & Analytics: analytics endpoint blocks client-forged order_submit events", async () => {
  const { POST } = await import(
    pathToFileURL(path.join(rootDir, "src/app/api/analytics/event/route.ts")).href
  );

  const forgedRes = await POST(
    await makeJsonReq("https://menuz-23.vercel.app/api/analytics/event", {
      tenantId: tenantA,
      eventType: "order_submit",
      metadata: { total: 999999 },
    })
  );
  assert.equal(forgedRes.status, 400);

  const scanRes = await POST(
    await makeJsonReq("https://menuz-23.vercel.app/api/analytics/event", {
      tenantId: tenantA,
      eventType: "menu_scan",
    })
  );
  assert.equal(scanRes.status, 200);
});

test("Stage 10 Orders & Analytics: /api/orders verifies prices from DB, permits optional name/phone, and prevents duplicates", async () => {
  const { POST } = await import(
    pathToFileURL(path.join(rootDir, "src/app/api/orders/route.ts")).href
  );

  const idemKey = "order_unique_key_12345";
  const res1 = await POST(
    await makeJsonReq("https://menuz-23.vercel.app/api/orders", {
      tenantId: tenantA,
      idempotencyKey: idemKey,
      items: [{ itemId: itemA1, quantity: 3 }],
      customerName: "",
      customerPhone: "",
      orderType: "pickup",
      paymentMethod: "cash",
      channel: "whatsapp",
    })
  );
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.ok, true);
  assert.equal(data1.computedTotal, 4050); // 1350 * 3 computed strictly server-side
  assert.equal(data1.duplicate, false);

  // Retry same idempotencyKey -> must deduplicate without double order/event
  const eventsBeforeRetry = recordedEvents.length;
  const res2 = await POST(
    await makeJsonReq("https://menuz-23.vercel.app/api/orders", {
      tenantId: tenantA,
      idempotencyKey: idemKey,
      items: [{ itemId: itemA1, quantity: 3 }],
      orderType: "pickup",
      paymentMethod: "cash",
      channel: "whatsapp",
    })
  );
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.duplicate, true);
  assert.equal(recordedEvents.length, eventsBeforeRetry);

  // Unavailable item must be rejected
  const res3 = await POST(
    await makeJsonReq("https://menuz-23.vercel.app/api/orders", {
      tenantId: tenantA,
      idempotencyKey: "order_unique_key_99999",
      items: [{ itemId: itemUnavailable, quantity: 1 }],
      orderType: "pickup",
      paymentMethod: "cash",
      channel: "whatsapp",
    })
  );
  assert.equal(res3.status, 400);
});

test("Stage 10 Isolation: tenant dashboard source never queries or displays order_feedback", () => {
  const dashboardPage = fs.readFileSync(
    path.join(rootDir, "src/app/dashboard/page.tsx"),
    "utf8"
  );
  const dashboardClient = fs.readFileSync(
    path.join(rootDir, "src/components/dashboard/client-dashboard-client.tsx"),
    "utf8"
  );
  assert.equal(dashboardPage.includes("order_feedback"), false);
  assert.equal(dashboardClient.includes("order_feedback"), false);
});
