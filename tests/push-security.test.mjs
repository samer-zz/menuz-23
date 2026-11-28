import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function loadTsModule(relPath, customMocks = {}) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in customMocks) return customMocks[specifier];
    if (specifier.startsWith("@/")) {
      return loadTsModule(`src/${specifier.slice(2)}.ts`, customMocks);
    }
    return require(specifier);
  };
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    outputText
  );
  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

test("Web Push SSRF Guard: allows only recognized browser push services over default HTTPS", () => {
  const pushSec = loadTsModule("src/lib/push-security.ts");

  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://fcm.googleapis.com/fcm/send/abc123"),
    true
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl(
      "https://updates.push.services.mozilla.com/wpush/v2/xyz"
    ),
    true
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://web.push.apple.com/QABCD1234"),
    true
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl(
      "https://wns2-bl2p.notify.windows.com/w/?token=123"
    ),
    true
  );

  // Blocked SSRF vectors
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("http://fcm.googleapis.com/fcm/send/abc"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://127.0.0.1/admin"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://169.254.169.254/latest/meta-data/"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://localhost/internal"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://fcm.googleapis.com:8443/fcm/send/abc"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://evil-attacker.example.com/push"),
    false
  );
  assert.equal(
    pushSec.isAllowedPushEndpointUrl("https://[::1]/push"),
    false
  );
});

test("Web Push DNS/IP Guard: distinguishes permanent private IPs from transient DNS errors", async () => {
  const pushSec = loadTsModule("src/lib/push-security.ts");

  const privateVectors = [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
  ];

  for (const ip of privateVectors) {
    const res = await pushSec.verifyPublicPushEndpoint(
      "https://fcm.googleapis.com/fcm/send/test",
      async () => [{ address: ip }]
    );
    assert.equal(res.ok, false, `Expected ${ip} to be rejected`);
    assert.equal(res.reason, "private_ip");
    assert.equal(res.permanent, true);
  }

  // Transient DNS errors must be non-permanent so healthy subscriptions survive DNS blips
  const transientErr = await pushSec.verifyPublicPushEndpoint(
    "https://fcm.googleapis.com/fcm/send/test",
    async () => {
      throw new Error("EAI_AGAIN");
    }
  );
  assert.deepEqual(transientErr, {
    ok: false,
    reason: "dns_transient_error",
    permanent: false,
  });

  const emptyDns = await pushSec.verifyPublicPushEndpoint(
    "https://fcm.googleapis.com/fcm/send/test",
    async () => []
  );
  assert.deepEqual(emptyDns, {
    ok: false,
    reason: "dns_transient_error",
    permanent: false,
  });

  const publicOk = await pushSec.verifyPublicPushEndpoint(
    "https://fcm.googleapis.com/fcm/send/test",
    async () => [{ address: "142.250.72.10" }]
  );
  assert.deepEqual(publicOk, { ok: true });
});

test("Web Push Dispatch: transient DNS failure never deletes subscriptions, 410 deletes stale only, and partial retry skips already-sent", async () => {
  const dispatcher = loadTsModule("src/lib/web-push-dispatch.ts");

  const prevPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prevPriv = process.env.VAPID_PRIVATE_KEY;
  const prevSub = process.env.VAPID_SUBJECT;
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test_public_key";
  process.env.VAPID_PRIVATE_KEY = "test_private_key";
  process.env.VAPID_SUBJECT = "mailto:admin@menuz.app";

  try {
    const subs = [
      {
        id: "sub-1",
        endpoint: "https://fcm.googleapis.com/fcm/send/one",
        p256dh: "p256dh-1",
        auth: "auth-1",
      },
      {
        id: "sub-2",
        endpoint: "https://updates.push.services.mozilla.com/wpush/v2/two",
        p256dh: "p256dh-2",
        auth: "auth-2",
      },
      {
        id: "sub-3",
        endpoint: "https://web.push.apple.com/expired",
        p256dh: "p256dh-3",
        auth: "auth-3",
      },
    ];

    const deletedIds = [];
    const deliveries = new Map();
    const notifUpdates = [];

    const mockAdmin = {
      from: (table) => {
        if (table === "push_subscriptions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({ data: subs, error: null }),
                }),
              }),
            }),
            delete: () => ({
              in: async (_col, ids) => {
                deletedIds.push(...ids);
                return { error: null };
              },
            }),
          };
        }
        if (table === "notification_push_deliveries") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({
                  data: Array.from(deliveries.values())
                    .filter((r) => r.status === "sent")
                    .map((r) => ({ subscription_id: r.subscription_id })),
                  error: null,
                }),
              }),
            }),
            upsert: (rows) => {
              for (const r of rows) {
                deliveries.set(`${r.notification_id}:${r.subscription_id}`, r);
              }
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "notifications") {
          return {
            update: (data) => ({
              eq: async (_col, id) => {
                notifUpdates.push({ id, data });
                return { error: null };
              },
            }),
          };
        }
        return {};
      },
    };

    // Attempt 1: sub-1 succeeds, sub-2 fails transient DNS, sub-3 returns 410 Gone
    const sentEndpointsAttempt1 = [];
    const res1 = await dispatcher.dispatchTenantWebPush({
      admin: mockAdmin,
      tenantId: "tenant-1",
      notificationId: "notif-1",
      tenantSlug: "demo",
      tenantName: "Demo",
      title: "عرض",
      body: "تجربة",
      lookupFn: async (host) => {
        if (host.includes("mozilla.com")) {
          throw new Error("SERVFAIL");
        }
        return [{ address: "142.250.72.10" }];
      },
      sendPushFn: async (sub) => {
        sentEndpointsAttempt1.push(sub.endpoint);
        if (sub.endpoint.includes("apple.com")) {
          const err = new Error("Gone");
          err.statusCode = 410;
          throw err;
        }
      },
    });

    assert.equal(res1.pushMode, "web_push_partial");
    assert.equal(res1.pushSent, 1);
    assert.equal(res1.pushFailed, 2);
    assert.equal(res1.pushCleaned, 1);
    assert.deepEqual(deletedIds, ["sub-3"]); // sub-2 (transient DNS) MUST NOT be deleted!

    await dispatcher.persistNotificationPushOutcome(mockAdmin, "notif-1", res1, 0);
    assert.equal(notifUpdates[0].data.push_sent, false);
    assert.equal(notifUpdates[0].data.push_status, "partial");

    // Simulate sub-3 already removed from DB; Attempt 2: DNS recovered -> sub-1 MUST be skipped, only sub-2 sent!
    subs.pop();
    const sentEndpointsAttempt2 = [];
    const res2 = await dispatcher.dispatchTenantWebPush({
      admin: mockAdmin,
      tenantId: "tenant-1",
      notificationId: "notif-1",
      tenantSlug: "demo",
      tenantName: "Demo",
      title: "عرض",
      body: "تجربة",
      lookupFn: async () => [{ address: "142.250.72.10" }],
      sendPushFn: async (sub) => {
        sentEndpointsAttempt2.push(sub.endpoint);
      },
    });

    assert.equal(res2.pushMode, "web_push_sent");
    assert.equal(res2.alreadySentCount, 1);
    assert.equal(res2.pushSent, 1);
    assert.deepEqual(sentEndpointsAttempt2, [
      "https://updates.push.services.mozilla.com/wpush/v2/two",
    ]);

    await dispatcher.persistNotificationPushOutcome(mockAdmin, "notif-1", res2, 1);
    assert.equal(notifUpdates[1].data.push_sent, true);
    assert.equal(notifUpdates[1].data.push_status, "sent");

    // Missing VAPID keys must report vapid_not_configured and keep push_sent = false
    delete process.env.VAPID_PRIVATE_KEY;
    const resNoVapid = await dispatcher.dispatchTenantWebPush({
      admin: mockAdmin,
      tenantId: "tenant-1",
      title: "عرض",
      body: "تجربة",
    });
    assert.equal(resNoVapid.pushMode, "vapid_not_configured");
    await dispatcher.persistNotificationPushOutcome(mockAdmin, "notif-2", resNoVapid, 0);
    assert.equal(notifUpdates[2].data.push_sent, false);
    assert.equal(notifUpdates[2].data.push_status, "vapid_not_configured");
  } finally {
    if (prevPub !== undefined) process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPub;
    else delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (prevPriv !== undefined) process.env.VAPID_PRIVATE_KEY = prevPriv;
    else delete process.env.VAPID_PRIVATE_KEY;
    if (prevSub !== undefined) process.env.VAPID_SUBJECT = prevSub;
    else delete process.env.VAPID_SUBJECT;
  }
});
