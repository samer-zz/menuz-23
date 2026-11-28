import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
let mockRpcMode = "v4";

globalThis.__menuzCronMockAdmin = () => ({
  rpc: async (fnName) => {
    if (fnName === "run_maintenance_cleanup") {
      if (mockRpcMode === "v4") {
        return {
          data: {
            notifications_deleted: 4,
            analytics_deleted: 120,
            audit_logs_deleted: 0,
            rate_limits_deleted: 15,
          },
          error: null,
        };
      }
      return { data: null, error: { message: "function does not exist" } };
    }
    if (fnName === "cleanup_expired_notifications") {
      return { data: 3, error: null };
    }
    return { data: null, error: null };
  },
  from: () => ({
    delete: () => ({
      lt: async () => ({ error: null }),
    }),
  }),
});

const loaderCode = `
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = ${JSON.stringify(rootDir)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase/admin") {
    return { shortCircuit: true, url: "data:text/javascript,export function createAdminSupabase() { return globalThis.__menuzCronMockAdmin(); }" };
  }
  if (specifier === "next/server") {
    return nextResolve(pathToFileURL(path.join(root, "node_modules/next/server.js")).href, context);
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(loaderCode)}`, import.meta.url);

test("Stage 11 Cron Retention: rejects missing or wrong CRON_SECRET", async () => {
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

test("Stage 11 Cron Retention: runs batched maintenance cleanup & legacy fallback cleanly", async () => {
  process.env.CRON_SECRET = "test-cron-secret-value-123";
  const { NextRequest } = await import("next/server");
  const { GET } = await import(
    pathToFileURL(
      path.join(rootDir, "src/app/api/cron/cleanup-notifications/route.ts")
    ).href
  );

  mockRpcMode = "v4";
  const r1 = await GET(
    new NextRequest("https://menuz-23.vercel.app/api/cron/cleanup-notifications", {
      headers: { authorization: "Bearer test-cron-secret-value-123" },
    })
  );
  assert.equal(r1.status, 200);
  const j1 = await r1.json();
  assert.equal(j1.ok, true);
  assert.equal(j1.mode, "run_maintenance_cleanup");
  assert.equal(j1.summary.analytics_deleted, 120);

  mockRpcMode = "legacy";
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
});
