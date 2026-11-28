import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
let mockRpcMode = "v4";
let mockNotifQueryMode = "empty";
let lastMaintParams = null;
let lastDeletedTable = null;
let lastDeletedColumn = null;
let lastNotifUpdate = null;

globalThis.__menuzCronMockAdmin = () => ({
  rpc: async (fnName, params) => {
    if (fnName === "run_maintenance_cleanup") {
      lastMaintParams = params;
      if (mockRpcMode === "v4") {
        return {
          data: {
            notifications_deleted: 4,
            api_rate_limits_deleted: 15,
            login_rate_limits_deleted: 2,
            analytics_events_deleted: 120,
            push_subscriptions_deleted: 1,
            batch_limit: params?.p_batch_limit,
          },
          error: null,
        };
      }
      if (mockRpcMode === "permission_error") {
        return {
          data: null,
          error: {
            code: "42501",
            message: "permission denied for function run_maintenance_cleanup",
          },
        };
      }
      return {
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.run_maintenance_cleanup(p_batch_limit) in the schema cache",
        },
      };
    }
    if (fnName === "cleanup_expired_notifications") {
      return { data: 3, error: null };
    }
    return { data: null, error: null };
  },
  from: (table) => {
    if (table === "notifications") {
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              lt: () => ({
                gt: () => ({
                  or: () => ({
                    order: () => ({
                      limit: async () => {
                        if (mockNotifQueryMode === "query_error") {
                          return {
                            data: null,
                            error: { message: "connection timeout" },
                          };
                        }
                        if (mockNotifQueryMode === "due_no_vapid") {
                          return {
                            data: [
                              {
                                id: "notif-due-1",
                                tenant_id: "tenant-1",
                                title: "عرض مجدول",
                                body: "خصم 20%",
                                push_attempts: 0,
                                push_status: "pending",
                              },
                            ],
                            error: null,
                          };
                        }
                        return { data: [], error: null };
                      },
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
        update: (data) => ({
          eq: async (_col, id) => {
            lastNotifUpdate = { id, data };
            return { error: null };
          },
        }),
      };
    }
    if (table === "tenants") {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: "tenant-1", slug: "demo", name_ar: "Demo" }],
            error: null,
          }),
        }),
      };
    }
    if (table === "push_subscriptions") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({
                data: [
                  {
                    id: "sub-1",
                    endpoint: "https://fcm.googleapis.com/fcm/send/test",
                    p256dh: "p256dh-val",
                    auth: "auth-val",
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "notification_push_deliveries") {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }),
      };
    }
    return {
      delete: () => ({
        lt: async (col) => {
          lastDeletedTable = table;
          lastDeletedColumn = col;
          return { error: null };
        },
      }),
    };
  },
});

const loaderCode = `
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = ${JSON.stringify(rootDir)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase/admin") {
    return { shortCircuit: true, url: "data:text/javascript,export function createAdminSupabase() { return globalThis.__menuzCronMockAdmin(); }" };
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const candidates = [
      path.join(root, "src", rel + ".ts"),
      path.join(root, "src", rel + ".tsx"),
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

test("Cron Retention: rejects missing or wrong CRON_SECRET", async () => {
  process.env.CRON_SECRET = "test-cron-secret-value-123";
  const { NextRequest } = await import("next/server");
  const { GET } = await import(
    pathToFileURL(
      path.join(rootDir, "src/app/api/cron/cleanup-notifications/route.ts")
    ).href
  );

  const rNoAuth = await GET(
    new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications")
  );
  assert.equal(rNoAuth.status, 401);

  const rWrong = await GET(
    new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
      headers: { authorization: "Bearer wrong-secret" },
    })
  );
  assert.equal(rWrong.status, 401);
});

test("Cron Retention: isolates push errors, preserves push_sent=false when VAPID missing, and enforces retention RPC", async () => {
  process.env.CRON_SECRET = "test-cron-secret-value-123";
  const prevPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prevPriv = process.env.VAPID_PRIVATE_KEY;
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;

  try {
    const { NextRequest } = await import("next/server");
    const { GET } = await import(
      pathToFileURL(
        path.join(rootDir, "src/app/api/cron/cleanup-notifications/route.ts")
      ).href
    );

    // 1. Due notification with missing VAPID must NOT set push_sent=true
    mockRpcMode = "v4";
    mockNotifQueryMode = "due_no_vapid";
    lastNotifUpdate = null;
    const rVapid = await GET(
      new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
        headers: { authorization: "Bearer test-cron-secret-value-123" },
      })
    );
    assert.equal(rVapid.status, 200);
    const jVapid = await rVapid.json();
    assert.equal(jVapid.scheduled_push.attempted, 1);
    assert.equal(jVapid.scheduled_push.vapid_not_configured, 1);
    assert.equal(jVapid.scheduled_push.sent, 0);
    assert.equal(lastNotifUpdate.data.push_sent, false);
    assert.equal(lastNotifUpdate.data.push_status, "vapid_not_configured");

    // 2. Push query error must be reported in scheduled_push.errors WITHOUT blocking retention cleanup
    mockNotifQueryMode = "query_error";
    const rQueryErr = await GET(
      new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
        headers: { authorization: "Bearer test-cron-secret-value-123" },
      })
    );
    assert.equal(rQueryErr.status, 200);
    const jQueryErr = await rQueryErr.json();
    assert.equal(jQueryErr.ok, true);
    assert.deepEqual(jQueryErr.scheduled_push.errors, [
      "due_notifications_query_failed",
    ]);
    assert.deepEqual(lastMaintParams, { p_batch_limit: 5000 });

    // 3. Permission/DB error on retention RPC must return 500
    mockNotifQueryMode = "empty";
    mockRpcMode = "permission_error";
    const rErr = await GET(
      new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
        headers: { authorization: "Bearer test-cron-secret-value-123" },
      })
    );
    assert.equal(rErr.status, 500);
    const jErr = await rErr.json();
    assert.equal(jErr.ok, false);

    // 4. Missing function falls back cleanly to api_rate_limits.window_start
    mockRpcMode = "legacy";
    lastDeletedTable = null;
    lastDeletedColumn = null;
    const r2 = await GET(
      new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
        headers: { authorization: "Bearer test-cron-secret-value-123" },
      })
    );
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.ok, true);
    assert.equal(j2.mode, "legacy_cleanup_fallback");
    assert.equal(j2.deleted_notifications, 3);
    assert.equal(lastDeletedTable, "api_rate_limits");
    assert.equal(lastDeletedColumn, "window_start");
  } finally {
    if (prevPub !== undefined) process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPub;
    if (prevPriv !== undefined) process.env.VAPID_PRIVATE_KEY = prevPriv;
  }
});
