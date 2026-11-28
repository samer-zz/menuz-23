import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminSupabase();
    const { count, error } = await admin
      .from("tenants")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Database check failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      service: "menuz-platform",
      tenants: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 500 }
    );
  }
}
