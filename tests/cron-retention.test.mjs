import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
let mockRpcMode = "v4";
let lastMaintParams = null;
let lastDeletedTable = null;
let lastDeletedColumn = null;

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
          error: { code: "42501", message: "permission denied for function run_maintenance_cleanup" },
        };
      }
      return {
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.run_maintenance_cleanup(p_batch_limit) in the schema cache",
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
            not: () => ({
              lte: () => ({
                gt: () => ({
                  order: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            }),
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

test("Cron Retention: calls run_maintenance_cleanup with p_batch_limit, propagates non-missing errors, and falls back to api_rate_limits.window_start", async () => {
  process.env.CRON_SECRET = "test-cron-secret-value-123";
  const { NextRequest } = await import("next/server");
  const { GET } = await import(
    pathToFileURL(
      path.join(rootDir, "src/app/api/cron/cleanup-notifications/route.ts")
    ).href
  );

  // 1. V4 RPC mode with exact p_batch_limit parameter
  mockRpcMode = "v4";
  lastMaintParams = null;
  const r1 = await GET(
    new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
      headers: { authorization: "Bearer test-cron-secret-value-123" },
    })
  );
  assert.equal(r1.status, 200);
  const j1 = await r1.json();
  assert.equal(j1.ok, true);
  assert.equal(j1.mode, "run_maintenance_cleanup");
  assert.deepEqual(lastMaintParams, { p_batch_limit: 5000 });
  assert.equal(j1.summary.analytics_events_deleted, 120);

  // 2. Permission/DB error must NOT silently fall back
  mockRpcMode = "permission_error";
  const rErr = await GET(
    new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
      headers: { authorization: "Bearer test-cron-secret-value-123" },
    })
  );
  assert.equal(rErr.status, 500);
  const jErr = await rErr.json();
  assert.equal(jErr.ok, false);

  // 3. Missing function falls back cleanly to api_rate_limits.window_start
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
});
