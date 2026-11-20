import type { MetadataRoute } from "next";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://menuz-23.vercel.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/services`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.8 },
  ];

  try {
    const admin = createAdminSupabase();
    const { data: tenants } = await admin
      .from("tenants")
      .select("slug, updated_at")
      .eq("is_active", true);

    const tenantRoutes: MetadataRoute.Sitemap = (tenants ?? []).map((t) => ({
      url: `${baseUrl}/m/${t.slug}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
      priority: 0.85,
    }));

    return [...staticRoutes, ...tenantRoutes];
  } catch {
    return staticRoutes;
  }
}
