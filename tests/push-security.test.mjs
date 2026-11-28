import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function loadTsModule(relPath) {
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
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    outputText
  );
  fn(mod.exports, require, mod, fullPath, path.dirname(fullPath));
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

test("Web Push DNS/IP Guard: rejects any private/loopback/metadata resolved IP", async () => {
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
    const ok = await pushSec.resolveAndVerifyPublicPushEndpoint(
      "https://fcm.googleapis.com/fcm/send/test",
      async () => [{ address: ip }]
    );
    assert.equal(ok, false, `Expected ${ip} to be rejected`);
  }

  const publicOk = await pushSec.resolveAndVerifyPublicPushEndpoint(
    "https://fcm.googleapis.com/fcm/send/test",
    async () => [{ address: "142.250.72.10" }]
  );
  assert.equal(publicOk, true);
});
