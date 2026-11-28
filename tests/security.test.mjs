import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function loadTsModule(relPath, mocks = {}) {
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

function makeValidPngHeaderOnly(width, height) {
  const buf = Buffer.alloc(32, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

async function makeRealPng(width, height, withAlpha = false) {
  const channels = withAlpha ? 4 : 3;
  const raw = Buffer.alloc(width * height * channels, 128);
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

async function makeRealJpegWithExif(width, height) {
  const raw = Buffer.alloc(width * height * 3, 96);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .withMetadata({ exif: { IFD0: { ImageDescription: "SENSITIVE_EXIF_GPS" } } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function makeRealWebp(width, height) {
  const raw = Buffer.alloc(width * height * 3, 200);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .webp({ quality: 90 })
    .toBuffer();
}

function makeUncompressedBmpSizePng(targetBytes, width, height) {
  // Valid lossless PNG whose zlib-stored pixels expand file size to exact test size (~1MB, 3MB, ~3.9MB)
  // Using sharp uncompressed PNG or appending valid PNG tEXt padding before IEND is impossible? Wait:
  // A valid PNG can contain an ancillary iTXt/tEXt/zTXt chunk before IEND, OR noisy RGBA pixels!
  // Let's generate noisy RGBA pixels via deterministic PRNG so sharp decodes real pixels cleanly!
  const channels = 4;
  const raw = Buffer.allocUnsafe(width * height * channels);
  let seed = 1337;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw[i] = (seed >>> 24) & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels } })
    .png({ compressionLevel: 0 })
    .toBuffer()
    .then((buf) => {
      assert.ok(buf.length <= 4 * 1024 * 1024, `Generated ${buf.length} bytes`);
      return buf;
    });
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

  const req1 = makeMockRequest({
    "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    "x-vercel-forwarded-for": "198.51.100.42",
  });
  assert.equal(security.getClientIp(req1), "198.51.100.42");

  const req2 = makeMockRequest({
    "x-forwarded-for": "spoofed-value-injection, 203.0.113.9",
  });
  assert.equal(security.getClientIp(req2), "203.0.113.9");

  assert.equal(security.normalizeIp("::ffff:192.0.2.55"), "192.0.2.55");
  assert.equal(security.normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(security.normalizeIp("not-an-ip-at-all"), null);

  // Missing IP headers do NOT collapse into a single "unknown" key across distinct clients
  const noIpA = security.getRateLimitIdentifier(
    makeMockRequest({ "user-agent": "Safari/iOS", "accept-language": "ar-YE" })
  );
  const noIpB = security.getRateLimitIdentifier(
    makeMockRequest({ "user-agent": "Chrome/Android", "accept-language": "en-US" })
  );
  assert.ok(noIpA.startsWith("fp:"));
  assert.ok(noIpB.startsWith("fp:"));
  assert.notEqual(noIpA, noIpB);

  const keyA = security.buildRateLimitKey("contact", "a".repeat(500));
  const keyB = security.buildRateLimitKey("contact", "b".repeat(500));
  assert.ok(keyA.startsWith("contact:"));
  assert.equal(keyA.length, "contact:".length + 32);
  assert.notEqual(keyA, keyB);
});

test("SSRF Guard: allows only local relative paths or menus-media Supabase storage URLs", () => {
  const security = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": { createAdminSupabase: () => ({}) },
  });

  assert.equal(security.isAllowedStorageMediaUrl("/branding/menuz1_logo.png"), true);
  assert.equal(
    security.isAllowedStorageMediaUrl("https://fmdfueuezjhnwwchoock.supabase.co/storage/v1/object/public/menus-media/demo/logo.webp"),
    true
  );
  assert.equal(security.isAllowedStorageMediaUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(security.isAllowedStorageMediaUrl("https://evil.example/logo.png"), false);
  assert.equal(security.isAllowedStorageMediaUrl("//evil.example/logo.png"), false);
  assert.equal(
    security.isAllowedStorageMediaUrl("https://fmdfueuezjhnwwchoock.supabase.co/storage/v1/object/public/menus-media/../secret/a.png"),
    false
  );
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

test("Server Image Decoder (sharp): decodes real PNG/JPEG/WebP, strips EXIF, enforces 4MiB & pixel limits, rejects truncated/forged", async () => {
  const {
    MAX_IMAGE_UPLOAD_BYTES,
    validateImageBuffer,
    decodeAndSanitizeImage,
  } = loadTsModule("src/lib/image-validation.ts");

  assert.equal(MAX_IMAGE_UPLOAD_BYTES, 4 * 1024 * 1024);

  // 1. Valid real PNG, JPEG (with EXIF), and WebP
  const pngBuf = await makeRealPng(120, 120, true);
  const jpgBuf = await makeRealJpegWithExif(240, 180);
  const webpBuf = await makeRealWebp(200, 200);

  const resPng = await decodeAndSanitizeImage(pngBuf);
  assert.equal(resPng.valid, true);
  assert.equal(resPng.mime, "image/webp");

  const resJpg = await decodeAndSanitizeImage(jpgBuf);
  assert.equal(resJpg.valid, true);
  assert.equal(resJpg.mime, "image/webp");
  // Verify EXIF metadata was stripped completely
  const reDecodedMeta = await sharp(resJpg.buffer).metadata();
  assert.equal(reDecodedMeta.exif, undefined);

  const resWebp = await decodeAndSanitizeImage(webpBuf);
  assert.equal(resWebp.valid, true);

  // 2. Sizes ~1MB, ~3MB, and ~3.9MB (under 4MiB) succeed; > 4MiB rejected
  const png1Mb = await makeUncompressedBmpSizePng(1024 * 1024, 520, 520); // ~1.08 MB
  assert.ok(png1Mb.length > 900 * 1024 && png1Mb.length < 1.5 * 1024 * 1024);
  assert.equal((await decodeAndSanitizeImage(png1Mb)).valid, true);

  const png3Mb = await makeUncompressedBmpSizePng(3 * 1024 * 1024, 880, 880); // ~3.10 MB
  assert.ok(png3Mb.length > 2.8 * 1024 * 1024 && png3Mb.length < 3.4 * 1024 * 1024);
  assert.equal((await decodeAndSanitizeImage(png3Mb)).valid, true);

  const pngNear4Mb = await makeUncompressedBmpSizePng(3.9 * 1024 * 1024, 990, 990); // ~3.92 MB
  assert.ok(pngNear4Mb.length > 3.7 * 1024 * 1024 && pngNear4Mb.length <= 4 * 1024 * 1024);
  assert.equal((await decodeAndSanitizeImage(pngNear4Mb)).valid, true);

  const over4MiB = Buffer.alloc(4 * 1024 * 1024 + 1, 0);
  assert.equal((await decodeAndSanitizeImage(over4MiB)).valid, false);

  // 3. Valid header with corrupted/truncated body MUST fail real sharp decoder
  const headerOnlyFakePng = makeValidPngHeaderOnly(400, 400);
  assert.equal(validateImageBuffer(headerOnlyFakePng).valid, true);
  assert.equal((await decodeAndSanitizeImage(headerOnlyFakePng)).valid, false);

  const truncatedJpeg = jpgBuf.subarray(0, Math.floor(jpgBuf.length / 2));
  assert.equal((await decodeAndSanitizeImage(truncatedJpeg)).valid, false);

  // 4. SVG / HTML / forged text rejected
  assert.equal(
    (await decodeAndSanitizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).valid,
    false
  );
  assert.equal(
    (await decodeAndSanitizeImage(Buffer.from("<!DOCTYPE html><html><script>alert(1)</script></html>"))).valid,
    false
  );

  // 5. Pixel bomb (> 25 MP, e.g. 5500x5500) rejected
  assert.equal(validateImageBuffer(makeValidPngHeaderOnly(5500, 5500)).valid, false);
  assert.equal(validateImageBuffer(makeValidPngHeaderOnly(1, 1)).valid, false);
});

test("Upload Route (/api/media/upload): pre-auth IP limit, 401, 403 tenant isolation, 404 unknown tenant, 413 >4MiB, 429 user limit, 503 unavailable, 200 success without Service Role", async () => {
  const { NextResponse } = require("next/server");
  const realImageValidation = loadTsModule("src/lib/image-validation.ts");
  const realSecurity = loadTsModule("src/lib/security.ts", {
    "@/lib/supabase/admin": { createAdminSupabase: () => ({}) },
  });

  const TENANT_A = "11111111-1111-4111-8111-111111111111";
  const TENANT_B = "22222222-2222-4222-8222-222222222222";
  const NON_EXISTENT_TENANT = "33333333-3333-4333-8333-333333333333";

  function makeUploadHandler(options) {
    let authCalls = 0;
    let profileCalls = 0;
    const uploadedObjects = [];

    const handlerMod = loadTsModule("src/app/api/media/upload/route.ts", {
      "next/server": { NextResponse },
      "@/lib/image-validation": realImageValidation,
      "@/lib/security": {
        ...realSecurity,
        enforceRateLimit: async (key) => {
          if (key.startsWith("upload-ip:")) {
            return options.ipRl ?? { status: "allowed", allowed: true };
          }
          if (key.startsWith("upload-user:")) {
            return options.userRl ?? { status: "allowed", allowed: true };
          }
          return { status: "allowed", allowed: true };
        },
      },
      "@/lib/supabase/admin": {
        createAdminSupabase: () => ({
          storage: {
            from: () => ({
              upload: async (objPath, buf, opts) => {
                uploadedObjects.push({ objPath, size: buf.length, opts });
                return { error: options.storageErr ?? null };
              },
              remove: async (paths) => {
                options.removedPaths?.push(...paths);
                return { error: null };
              },
              getPublicUrl: (objPath) => ({
                data: {
                  publicUrl: `https://example.supabase.co/storage/v1/object/public/menus-media/${objPath}`,
                },
              }),
            }),
          },
        }),
      },
      "@/lib/supabase/server": {
        createServerSupabase: async () => ({
          auth: {
            getUser: async () => {
              authCalls++;
              return { data: { user: options.user ?? null } };
            },
          },
          from: (table) => {
            if (table === "profiles") {
              profileCalls++;
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({ data: options.profile ?? null }),
                  }),
                }),
              };
            }
            if (table === "tenants") {
              return {
                select: () => ({
                  eq: (_col, val) => ({
                    maybeSingle: async () => ({
                      data: val === TENANT_A ? { id: TENANT_A } : null,
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        }),
      },
    });

    return {
      POST: handlerMod.POST,
      DELETE: handlerMod.DELETE,
      getCounts: () => ({ authCalls, profileCalls, uploadedObjects }),
    };
  }

  function makeUploadRequest({ file, folder = "item", tenantId = "", headers = {} }) {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (folder) fd.append("folder", folder);
    if (tenantId) fd.append("tenantId", tenantId);
    const req = new Request("https://menuz-23.vercel.app/api/media/upload", {
      method: "POST",
      headers: {
        host: "menuz-23.vercel.app",
        origin: "https://menuz-23.vercel.app",
        "x-vercel-forwarded-for": "198.51.100.10",
        ...headers,
      },
      body: fd,
    });
    return req;
  }

  // Case 1: Pre-auth IP rate limit blocks BEFORE calling Supabase Auth or profiles
  {
    const { POST, getCounts } = makeUploadHandler({
      ipRl: { status: "rate_limited", allowed: false },
    });
    const res = await POST(makeUploadRequest({}));
    assert.equal(res.status, 429);
    assert.equal(getCounts().authCalls, 0);
    assert.equal(getCounts().profileCalls, 0);
  }

  // Case 2: Rate limit store unavailable -> 503 fail-closed
  {
    const { POST, getCounts } = makeUploadHandler({
      ipRl: { status: "unavailable", allowed: false },
    });
    const res = await POST(makeUploadRequest({}));
    assert.equal(res.status, 503);
    assert.equal(getCounts().authCalls, 0);
  }

  // Case 3: Unauthenticated visitor -> 401 and zero profile queries
  {
    const { POST, getCounts } = makeUploadHandler({ user: null });
    const res = await POST(makeUploadRequest({}));
    assert.equal(res.status, 401);
    assert.equal(getCounts().authCalls, 1);
    assert.equal(getCounts().profileCalls, 0);
  }

  // Case 4: Authenticated user exceeds per-user rate limit -> 429 before profile query
  {
    const { POST, getCounts } = makeUploadHandler({
      user: { id: "user-1" },
      userRl: { status: "rate_limited", allowed: false },
    });
    const res = await POST(makeUploadRequest({}));
    assert.equal(res.status, 429);
    assert.equal(getCounts().profileCalls, 0);
  }

  // Case 5: Oversized request (> 4MiB) -> 413
  {
    const { POST } = makeUploadHandler({
      user: { id: "user-1" },
      profile: { role: "client_admin", tenant_id: TENANT_A },
    });
    const bigFile = new File([Buffer.alloc(4 * 1024 * 1024 + 50, 1)], "big.png", {
      type: "image/png",
    });
    const res = await POST(makeUploadRequest({ file: bigFile, tenantId: TENANT_A }));
    assert.equal(res.status, 413);
  }

  // Case 6: Tenant Admin trying to upload to another tenantId -> 403
  {
    const { POST, getCounts } = makeUploadHandler({
      user: { id: "user-1" },
      profile: { role: "client_admin", tenant_id: TENANT_A },
    });
    const validPng = new File([await makeRealPng(100, 100)], "ok.png", {
      type: "image/png",
    });
    const res = await POST(makeUploadRequest({ file: validPng, tenantId: TENANT_B }));
    assert.equal(res.status, 403);
    assert.equal(getCounts().uploadedObjects.length, 0);
  }

  // Case 7: Super Admin passing non-existent tenantId -> 404
  {
    const { POST, getCounts } = makeUploadHandler({
      user: { id: "super-1" },
      profile: { role: "super_admin", tenant_id: null },
    });
    const validPng = new File([await makeRealPng(100, 100)], "ok.png", {
      type: "image/png",
    });
    const res = await POST(
      makeUploadRequest({ file: validPng, tenantId: NON_EXISTENT_TENANT })
    );
    assert.equal(res.status, 404);
    assert.equal(getCounts().uploadedObjects.length, 0);
  }

  // Case 8: Client Admin uploads valid image to own tenant -> 200, re-encoded to WebP under tenant folder
  {
    const { POST, getCounts } = makeUploadHandler({
      user: { id: "user-1" },
      profile: { role: "client_admin", tenant_id: TENANT_A },
    });
    const validPng = new File([await makeRealPng(150, 150, true)], "dish.png", {
      type: "image/png",
    });
    const res = await POST(
      makeUploadRequest({ file: validPng, folder: "item", tenantId: TENANT_A })
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(getCounts().uploadedObjects.length, 1);
    assert.ok(getCounts().uploadedObjects[0].objPath.startsWith(`${TENANT_A}/item-`));
    assert.equal(getCounts().uploadedObjects[0].opts.contentType, "image/webp");
  }

  // Case 9: DELETE /api/media/upload enforces tenant isolation & blocks traversal
  {
    const removedPaths = [];
    const { DELETE } = makeUploadHandler({
      user: { id: "user-1" },
      profile: { role: "client_admin", tenant_id: TENANT_A },
      removedPaths,
    });

    const delCross = await DELETE(
      new Request("https://menuz-23.vercel.app/api/media/upload", {
        method: "DELETE",
        headers: {
          host: "menuz-23.vercel.app",
          origin: "https://menuz-23.vercel.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ path: `${TENANT_B}/item-123.webp` }),
      })
    );
    assert.equal(delCross.status, 403);

    const delTraversal = await DELETE(
      new Request("https://menuz-23.vercel.app/api/media/upload", {
        method: "DELETE",
        headers: {
          host: "menuz-23.vercel.app",
          origin: "https://menuz-23.vercel.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ path: `${TENANT_A}/../${TENANT_B}/item-123.webp` }),
      })
    );
    assert.equal(delTraversal.status, 400);

    const delOwn = await DELETE(
      new Request("https://menuz-23.vercel.app/api/media/upload", {
        method: "DELETE",
        headers: {
          host: "menuz-23.vercel.app",
          origin: "https://menuz-23.vercel.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ path: `${TENANT_A}/item-123.webp` }),
      })
    );
    assert.equal(delOwn.status, 200);
    assert.deepEqual(removedPaths, [`${TENANT_A}/item-123.webp`]);
  }
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
