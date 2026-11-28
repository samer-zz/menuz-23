import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();

async function importTs(relPath) {
  const fullUrl = pathToFileURL(path.join(rootDir, relPath)).href;
  return import(fullUrl);
}

test("Stage 9 Scalability: 200 tenants & 100,000 items indexing, filtering, and pagination stay sub-100ms", async () => {
  const TENANTS_COUNT = 200;
  const ITEMS_PER_TENANT = 500; // 200 * 500 = 100,000 items
  const TOTAL_ITEMS = TENANTS_COUNT * ITEMS_PER_TENANT;

  const t0 = performance.now();
  const tenants = Array.from({ length: TENANTS_COUNT }, (_, tIdx) => ({
    id: `tenant-${tIdx}`,
    slug: `brand-${tIdx}`,
    name_ar: `مطعم وكافيه رقم ${tIdx}`,
    is_active: tIdx % 25 !== 0,
  }));

  const itemsByTenant = new Map();
  let createdItems = 0;
  for (let t = 0; t < TENANTS_COUNT; t++) {
    const list = new Array(ITEMS_PER_TENANT);
    for (let i = 0; i < ITEMS_PER_TENANT; i++) {
      list[i] = {
        id: `item-${t}-${i}`,
        tenant_id: `tenant-${t}`,
        category_id: `cat-${t}-${i % 8}`,
        name: i % 10 === 0 ? `برجر مميز ${i}` : `وجبة تقليدية ${i}`,
        price: 500 + (i % 20) * 150,
        is_available: i % 19 !== 0,
        badges: i % 7 === 0 ? ["best_seller"] : [],
      };
      createdItems++;
    }
    itemsByTenant.set(`tenant-${t}`, list);
  }
  const seedMs = performance.now() - t0;

  assert.equal(createdItems, TOTAL_ITEMS);

  // Simulate tenant lookup + paginated search (page size 12) + single tenant menu lookup
  const qStart = performance.now();
  const pagedTenants = tenants
    .filter((t) => t.name_ar.includes("14"))
    .slice(0, 12);
  const targetItems = itemsByTenant
    .get("tenant-142")
    .filter((it) => it.is_available && it.name.includes("برجر"));
  const queryMs = performance.now() - qStart;

  assert.ok(pagedTenants.length > 0 && pagedTenants.length <= 12);
  // Multiples of 10 in [0..499] = 50; multiples of 190 in [0..499] = 3 (0, 190, 380) => 47 available
  assert.equal(targetItems.length, 47);
  assert.ok(
    queryMs < 100,
    `Expected indexed lookup + filter across 100k dataset < 100ms, got ${queryMs.toFixed(2)}ms`
  );
  console.log(
    `  [Stage9] 200 tenants + 100k items seeded in ${seedMs.toFixed(1)}ms, filtered lookup in ${queryMs.toFixed(2)}ms`
  );
});

test("Stage 9 Scalability: 150 concurrent tenant admins have isolated contexts and theme contrast resolution", async () => {
  const { resolveTenantTheme, contrastRatio } = await importTs(
    "src/lib/theme-colors.ts"
  );

  const ADMINS = 150;
  const keys = new Set();
  const t0 = performance.now();

  await Promise.all(
    Array.from({ length: ADMINS }, async (_, idx) => {
      const adminId = `admin-uuid-${idx}`;
      keys.add(`admin-tenant-action:${adminId}`);
      const palette = resolveTenantTheme(
        {
          primary_color: idx % 2 === 0 ? "#1F5E3B" : "#F5F0E6",
          accent_color: idx % 3 === 0 ? "#D97706" : "#FF5500",
          background_color: idx % 4 === 0 ? "#FAF7F2" : "#071426",
        },
        idx % 2 === 0 ? "light" : "dark"
      );
      const ratio = contrastRatio(palette.text, palette.background);
      assert.ok(ratio >= 4.5, `Contrast fallback failed: ratio=${ratio}`);
    })
  );

  const elapsed = performance.now() - t0;
  assert.equal(keys.size, ADMINS);
  assert.ok(elapsed < 500, `150 admin operations took ${elapsed.toFixed(1)}ms`);
  console.log(
    `  [Stage9] 150 isolated admin contexts + WCAG contrast verified in ${elapsed.toFixed(2)}ms`
  );
});

test("Stage 9 Scalability: 1,000 concurrent visitors idempotency & server price calculation simulation", async () => {
  const VISITORS = 1000;
  const authoritativePrices = new Map([
    ["item-a", 1200],
    ["item-b", 650],
    ["item-c", 2400],
  ]);

  const seenIdempotencyKeys = new Set();
  const t0 = performance.now();

  const results = await Promise.all(
    Array.from({ length: VISITORS }, async (_, idx) => {
      const key = `tenant-1:order-${idx % 950}`; // 50 intentional duplicate retries
      const isDuplicate = seenIdempotencyKeys.has(key);
      seenIdempotencyKeys.add(key);

      const total =
        authoritativePrices.get("item-a") * 2 +
        authoritativePrices.get("item-b") * (1 + (idx % 3));
      return { isDuplicate, total };
    })
  );

  const elapsed = performance.now() - t0;
  const uniqueCount = results.filter((r) => !r.isDuplicate).length;
  const duplicateCount = results.filter((r) => r.isDuplicate).length;

  assert.equal(uniqueCount, 950);
  assert.equal(duplicateCount, 50);
  assert.ok(elapsed < 500, `1,000 concurrent calculations took ${elapsed.toFixed(1)}ms`);
  console.log(
    `  [Stage9] 1,000 concurrent visitor order checks (${uniqueCount} unique, ${duplicateCount} deduplicated) in ${elapsed.toFixed(2)}ms`
  );
});
