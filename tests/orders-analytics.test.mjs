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
const walletA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const walletOtherTenant = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const storedOrders = [];
const storedFeedbacks = [];
const recordedEvents = [];

function createMockAdminSupabase() {
  return {
    rpc: async (fnName, params) => {
      if (fnName === "check_api_rate_limit") {
        return { data: true, error: null };
      }
      if (fnName === "create_order_atomic") {
        const existing = storedOrders.find(
          (o) =>
            o.tenant_id === params.p_tenant_id &&
            o.idempotency_key === params.p_idempotency_key
        );
        if (existing) {
          if (existing.payload_hash !== params.p_payload_hash) {
            return {
              data: {
                outcome: "conflict",
                order_id: existing.id,
                order_number: existing.order_number,
              },
              error: null,
            };
          }
          return {
            data: {
              outcome: "duplicate",
              order_id: existing.id,
              order_number: existing.order_number,
              computed_total: existing.computed_total,
              currency: existing.currency,
              items_snapshot: existing.items_snapshot,
            },
            error: null,
          };
        }

        const created = {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee" + String(storedOrders.length + 1),
          tenant_id: params.p_tenant_id,
          order_number: params.p_order_number,
          idempotency_key: params.p_idempotency_key,
          payload_hash: params.p_payload_hash,
          feedback_token_hash: params.p_feedback_token_hash,
          computed_total: params.p_computed_total,
          currency: params.p_currency,
          items_snapshot: params.p_items_snapshot,
        };
        storedOrders.push(created);
        recordedEvents.push({
          fnName: "record_menu_event",
          event_type: "order_submit",
          total: params.p_computed_total,
        });
        return {
          data: {
            outcome: "created",
            order_id: created.id,
            order_number: created.order_number,
            computed_total: created.computed_total,
            currency: created.currency,
            items_snapshot: created.items_snapshot,
          },
          error: null,
        };
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
          select: () => {
            const filters = {};
            const chain = {
              eq: (col, val) => {
                filters[col] = val;
                return chain;
              },
              maybeSingle: async () => ({
                data:
                  filters.id === tenantA
                    ? {
                        id: tenantA,
                        name_ar: "مطعم اختبار",
                        currency: "ر.ي",
                        is_active: true,
                        has_delivery: true,
                      }
                    : null,
                error: null,
              }),
            };
            return chain;
          },
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
      if (table === "wallets") {
        return {
          select: () => {
            const filters = {};
            const chain = {
              eq: (col, val) => {
                filters[col] = val;
                return chain;
              },
              maybeSingle: async () => ({
                data:
                  filters.id === walletA && filters.tenant_id === tenantA
                    ? {
                        name: "جيب",
                        account_number: "777000111",
                        is_active: true,
                      }
                    : null,
                error: null,
              }),
            };
            return chain;
          },
        };
      }
      if (table === "orders") {
        return {
          select: () => {
            const filters = {};
            const chain = {
              eq: (col, val) => {
                filters[col] = val;
                return chain;
              },
              maybeSingle: async () => {
                const found = storedOrders.find(
                  (o) =>
                    o.id === filters.id && o.tenant_id === filters.tenant_id
                );
                return { data: found ?? null, error: null };
              },
            };
            return chain;
          },
        };
      }
      if (table === "order_feedback") {
        return {
          insert: async (row) => {
            if (storedFeedbacks.some((f) => f.order_id === row.order_id)) {
              return { error: { code: "23505", message: "duplicate key" } };
            }
            storedFeedbacks.push(row);
            return { error: null };
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

test("Orders & Analytics: analytics blocks forged order_submit events", async () => {
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

test("Orders & Feedback: atomic idempotency, 409 conflict on payload mismatch, wallet check, and cryptographic feedback eligibility", async () => {
  const { POST: postOrder } = await import(
    pathToFileURL(path.join(rootDir, "src/app/api/orders/route.ts")).href
  );
  const { POST: postFeedback } = await import(
    pathToFileURL(path.join(rootDir, "src/app/api/feedback/route.ts")).href
  );

  const idemKey = "order_unique_key_12345";
  const res1 = await postOrder(
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
  assert.equal(data1.computedTotal, 4050);
  assert.equal(data1.duplicate, false);
  assert.ok(typeof data1.feedbackToken === "string" && data1.feedbackToken.length >= 20);

  // Retry identical payload -> deduplicates cleanly (no new order, no new event, no re-issued token)
  const eventsBeforeRetry = recordedEvents.length;
  const res2 = await postOrder(
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
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.duplicate, true);
  assert.equal(data2.feedbackToken, undefined);
  assert.equal(recordedEvents.length, eventsBeforeRetry);

  // Reused idempotencyKey with DIFFERENT payload -> 409 Conflict
  const resConflict = await postOrder(
    await makeJsonReq("https://menuz-23.vercel.app/api/orders", {
      tenantId: tenantA,
      idempotencyKey: idemKey,
      items: [{ itemId: itemA1, quantity: 1 }],
      orderType: "pickup",
      paymentMethod: "cash",
      channel: "whatsapp",
    })
  );
  assert.equal(resConflict.status, 409);

  // Cross-tenant walletId must be rejected (400)
  const resBadWallet = await postOrder(
    await makeJsonReq("https://menuz-23.vercel.app/api/orders", {
      tenantId: tenantA,
      idempotencyKey: "order_bad_wallet_12345",
      items: [{ itemId: itemA1, quantity: 1 }],
      orderType: "pickup",
      paymentMethod: "wallet",
      walletId: walletOtherTenant,
      transactionRef: "TX-1234",
      channel: "whatsapp",
    })
  );
  assert.equal(resBadWallet.status, 400);

  // Unavailable item must be rejected
  const res3 = await postOrder(
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

  // Feedback without valid token -> 400/403
  const fbNoToken = await postFeedback(
    await makeJsonReq("https://menuz-23.vercel.app/api/feedback", {
      tenantId: tenantA,
      orderId: data1.orderId,
      feedbackToken: "forged-token-that-should-fail-000",
      rating: 5,
    })
  );
  assert.equal(fbNoToken.status, 403);

  // Feedback with valid token -> 200
  const fbValid = await postFeedback(
    await makeJsonReq("https://menuz-23.vercel.app/api/feedback", {
      tenantId: tenantA,
      orderId: data1.orderId,
      feedbackToken: data1.feedbackToken,
      rating: 5,
      comment: "تجربة سريعة ورائعة",
    })
  );
  assert.equal(fbValid.status, 200);

  // Duplicate feedback for same order -> 409
  const fbDup = await postFeedback(
    await makeJsonReq("https://menuz-23.vercel.app/api/feedback", {
      tenantId: tenantA,
      orderId: data1.orderId,
      feedbackToken: data1.feedbackToken,
      rating: 4,
    })
  );
  assert.equal(fbDup.status, 409);
});

test("Isolation: tenant dashboard source never queries or displays order_feedback", () => {
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
