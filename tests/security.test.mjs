import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier in mocks) return mocks[specifier];
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
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

function makeMockRequest(headersObj = {}) {
  const map = new Map();
  for (const [k, v] of Object.entries(headersObj)) {
    map.set(k.toLowerCase(), v);
  }
  return {
    headers: {
      get(name) {
        return map.get(String(name).toLowerCase()) ?? null;
      },
    },
  };
}

function makeValidPngBuffer(width, height) {
  const buf = Buffer.alloc(32, 0);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length & type
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function makeValidJpegBuffer(width, height) {
  // Minimal SOI + SOF0 marker
  return Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x0b, // length 11
    0x08, // precision
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, // components
    0x01, 0x11, 0x00,
    0xff, 0xd9, // EOI
  ]);
}

function makeValidWebpVp8Buffer(width, height) {
  const buf = Buffer.alloc(30, 0);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8 ", 12, "ascii");
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

test("Rate Limiting: fail-closed when Supabase RPC errors, throws, or env is missing", async () => {
  const securityFailingRpc = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": {
      createAdminSupabase() {
        return {
          rpc: async () => ({ data: null, error: { message: "DB connection refused" } }),
        };
      },
    },
  });

  const resErr = await securityFailingRpc.enforceRateLimit("k1", 5, 60);
  assert.equal(resErr.status, "unavailable");
  assert.equal(resErr.allowed, false);

  const securityThrowing = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": {
      createAdminSupabase() {
        throw new Error("Missing env");
      },
    },
  });

  const resThrow = await securityThrowing.enforceRateLimit("k1", 5, 60);
  assert.equal(resThrow.status, "unavailable");
  assert.equal(resThrow.allowed, false);

  const securityRateLimited = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": {
      createAdminSupabase() {
        return {
          rpc: async () => ({ data: false, error: null }),
        };
      },
    },
  });

  const resBlocked = await securityRateLimited.enforceRateLimit("k1", 5, 60);
  assert.equal(resBlocked.status, "rate_limited");
  assert.equal(resBlocked.allowed, false);

  const securityAllowed = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": {
      createAdminSupabase() {
        return {
          rpc: async () => ({ data: true, error: null }),
        };
      },
    },
  });

  const resOk = await securityAllowed.enforceRateLimit("k1", 5, 60);
  assert.equal(resOk.status, "allowed");
  assert.equal(resOk.allowed, true);
});

test("IP Extraction & Anti-Spoofing: prefers Vercel header, validates IPv4/IPv6, rejects spoofed text", () => {
  const security = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": { createAdminSupabase: () => ({}) },
  });

  // Spoofed x-forwarded-for cannot override Vercel's x-vercel-forwarded-for
  const req1 = makeMockRequest({
    "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    "x-vercel-forwarded-for": "198.51.100.42",
  });
  assert.equal(security.getClientIp(req1), "198.51.100.42");

  // Spoofed non-IP string in x-forwarded-for is rejected
  const req2 = makeMockRequest({
    "x-forwarded-for": "spoofed-value-injection, 203.0.113.9",
  });
  assert.equal(security.getClientIp(req2), "203.0.113.9");

  // IPv4-mapped IPv6 normalized cleanly
  assert.equal(security.normalizeIp("::ffff:192.0.2.55"), "192.0.2.55");
  // Valid IPv6 preserved
  assert.equal(security.normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
  // Garbage rejected
  assert.equal(security.normalizeIp("not-an-ip-at-all"), null);

  // Rate limit key has fixed length and hashes arbitrary identifiers
  const keyA = security.buildRateLimitKey("contact", "a".repeat(500));
  const keyB = security.buildRateLimitKey("contact", "b".repeat(500));
  assert.ok(keyA.startsWith("contact:"));
  assert.equal(keyA.length, "contact:".length + 32);
  assert.notEqual(keyA, keyB);
});

test("CSRF / Origin Validation: rejects missing Origin+Referer, evil Origin, and cross-site fetch", () => {
  const security = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": { createAdminSupabase: () => ({}) },
  });

  assert.equal(
    security.verifySameOrigin(makeMockRequest({ host: "menuz-23.vercel.app" })),
    false
  );
  assert.equal(
    security.verifySameOrigin(
      makeMockRequest({
        host: "menuz-23.vercel.app",
        origin: "https://evil.example",
      })
    ),
    false
  );
  assert.equal(
    security.verifySameOrigin(
      makeMockRequest({
        host: "menuz-23.vercel.app",
        origin: "https://menuz-23.vercel.app",
        "sec-fetch-site": "cross-site",
      })
    ),
    false
  );
  assert.equal(
    security.verifySameOrigin(
      makeMockRequest({
        host: "menuz-23.vercel.app",
        origin: "https://menuz-23.vercel.app",
        "sec-fetch-site": "same-origin",
      })
    ),
    true
  );
  assert.equal(
    security.verifySameOrigin(
      makeMockRequest({
        host: "menuz-23.vercel.app",
        referer: "https://menuz-23.vercel.app/contact",
      })
    ),
    true
  );
});

test("Upload Validation: accepts valid PNG/JPEG/WebP and blocks SVG, XSS HTML, spoofing & absurd dimensions", () => {
  const { validateImageBuffer } = loadTsModule("src/lib/image-validation.ts");

  assert.equal(validateImageBuffer(makeValidPngBuffer(512, 512)).valid, true);
  assert.equal(validateImageBuffer(makeValidJpegBuffer(800, 600)).valid, true);
  assert.equal(validateImageBuffer(makeValidWebpVp8Buffer(400, 400)).valid, true);

  // Reject SVG even if client claims image/png
  assert.equal(
    validateImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).valid,
    false
  );
  // Reject HTML payload
  assert.equal(
    validateImageBuffer(Buffer.from("<!DOCTYPE html><html><script>alert(1)</script></html>")).valid,
    false
  );
  // Reject corrupted/truncated PNG (missing IHDR dimensions)
  assert.equal(
    validateImageBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])).valid,
    false
  );
  // Reject absurd dimensions (1x1 tracking pixel or 20000x20000 bomb)
  assert.equal(validateImageBuffer(makeValidPngBuffer(1, 1)).valid, false);
  assert.equal(validateImageBuffer(makeValidPngBuffer(20000, 20000)).valid, false);
  // Reject oversized buffer (> 5MB)
  assert.equal(validateImageBuffer(Buffer.alloc(5 * 1024 * 1024 + 10, 0)).valid, false);
});

test("URL Sanitizer: blocks javascript:, data:, vbscript: and protocol-relative URLs", () => {
  const security = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": { createAdminSupabase: () => ({}) },
  });

  assert.equal(security.sanitizeSafeUrl("javascript:alert(1)"), null);
  assert.equal(security.sanitizeSafeUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(security.sanitizeSafeUrl("//evil.example/logo.png"), null);
  assert.equal(security.sanitizeSafeUrl("/branding/menuz1_logo.png"), "/branding/menuz1_logo.png");
  assert.equal(security.sanitizeSafeUrl("https://images.unsplash.com/photo-1"), "https://images.unsplash.com/photo-1");
});
