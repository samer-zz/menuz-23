import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const normalizedSlug = slug?.trim().toLowerCase();

  let appName = "مينوز | MENUZ — المنيو الرقمي الذكي";
  let shortName = "MENUZ";
  let description =
    "امسح .. اطلب .. واستمتع | منصة المنيوهات الرقمية التفاعلية من شركة سامرز للحلول الذكية";
  let startUrl = "/";
  let themeColor = "#0B2D5B";
  const backgroundColor = "#040E21";
  let iconUrl = "/icons/icon-192.png";
  let iconLargeUrl = "/icons/icon-512.png";

  if (normalizedSlug && normalizedSlug !== "default") {
    try {
      const supabase = await createServerSupabase();
      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug, name_ar, name_en, description, primary_color, logo_url, is_active")
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (tenant && tenant.is_active) {
        appName = `${tenant.name_ar} — منيو مينوز`;
        shortName = tenant.name_en || tenant.name_ar.slice(0, 14);
        description =
          tenant.description ||
          `تصفح واطلب مباشرة من منيو ${tenant.name_ar} عبر مينوز`;
        startUrl = `/m/${tenant.slug}`;
        themeColor = tenant.primary_color || "#0B2D5B";
        if (tenant.logo_url && tenant.logo_url.startsWith("/")) {
          iconUrl = tenant.logo_url;
          iconLargeUrl = tenant.logo_url;
        }
      }
    } catch {
      // Fallback safely to root start_url
    }
  }

  const manifest = {
    id: startUrl,
    name: appName,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait-primary",
    dir: "rtl",
    lang: "ar",
    icons: [
      {
        src: iconUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: iconLargeUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
