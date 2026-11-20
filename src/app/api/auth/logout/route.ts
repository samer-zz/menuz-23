import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifySameOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
