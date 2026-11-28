import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAllowedStorageMediaUrl } from "@/lib/security";

export const dynamic = "force-dynamic";

async function readFallbackIcon(size: number): Promise<Buffer> {
  const filename = size >= 384 ? "icon-512.png" : "icon-192.png";
  const filePath = path.join(process.cwd(), "public", "icons", filename);
  return fs.readFile(filePath);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rawSize = Number(request.nextUrl.searchParams.get("size") || "192");
  const size = rawSize >= 384 ? 512 : rawSize === 180 ? 180 : 192;

  const normalizedSlug = slug?.trim().toLowerCase();
  let sourceBuffer: Buffer | null = null;

  if (normalizedSlug && normalizedSlug !== "default") {
    try {
      const supabase = await createServerSupabase();
      const { data: tenant } = await supabase
        .from("tenants")
        .select("logo_url, is_active")
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (tenant?.is_active && tenant.logo_url && isAllowedStorageMediaUrl(tenant.logo_url)) {
        if (tenant.logo_url.startsWith("/")) {
          const safeRel = tenant.logo_url.replace(/^\/+/, "");
          const localPath = path.resolve(process.cwd(), "public", safeRel);
          const publicRoot = path.resolve(process.cwd(), "public");
          if (localPath.startsWith(publicRoot + path.sep)) {
            sourceBuffer = await fs.readFile(localPath).catch(() => null);
          }
        } else {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          try {
            const imgRes = await fetch(tenant.logo_url, {
              signal: controller.signal,
            });
            if (imgRes.ok) {
              const arr = await imgRes.arrayBuffer();
              if (arr.byteLength > 0 && arr.byteLength <= 4 * 1024 * 1024) {
                sourceBuffer = Buffer.from(arr);
              }
            }
          } finally {
            clearTimeout(timer);
          }
        }
      }
    } catch {
      sourceBuffer = null;
    }
  }

  try {
    const input = sourceBuffer || (await readFallbackIcon(size));
    const pngBuffer = await sharp(input, {
      failOn: "error",
      limitInputPixels: 25_000_000,
    })
      .resize(size, size, {
        fit: "cover",
        position: "centre",
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    const fallback = await readFallbackIcon(size);
    return new NextResponse(new Uint8Array(fallback), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
