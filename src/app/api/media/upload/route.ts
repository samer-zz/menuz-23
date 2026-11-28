import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateImageBuffer, MAX_IMAGE_UPLOAD_BYTES } from "@/lib/image-validation";
import {
  buildRateLimitKey,
  enforceRateLimit,
  verifySameOrigin,
} from "@/lib/security";

const ALLOWED_FOLDERS = new Set([
  "item",
  "wallet",
  "logo",
  "cover",
]);

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  let user: { id: string } | null = null;
  let profile: { role: string; tenant_id: string | null } | null = null;

  try {
    supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;

    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single();
    profile = profileData;
  } catch {
    return NextResponse.json(
      { error: "خدمة التحقق من الهوية غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const rl = await enforceRateLimit(
    buildRateLimitKey("upload", user.id),
    30,
    600
  );
  if (rl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز حد رفع الصور المؤقت، يرجى الانتظار" },
      { status: 429 }
    );
  }
  if (rl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "بيانات الرفع غير صالحة" }, { status: 400 });
  }

  const file = formData.get("file");
  const rawFolder = String(formData.get("folder") || "item").trim().toLowerCase();
  const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "item";
  const requestedTenantId = String(formData.get("tenantId") || "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "يرجى إرفاق ملف صورة صالح" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const check = validateImageBuffer(buffer);
  if (!check.valid || !check.mime || !check.ext) {
    return NextResponse.json(
      { error: check.error || "ملف الصورة غير صالح" },
      { status: 400 }
    );
  }

  let baseFolder: string;
  if (profile.role === "super_admin") {
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    baseFolder =
      requestedTenantId && uuidRe.test(requestedTenantId)
        ? requestedTenantId
        : "super-admin";
  } else if (profile.role === "client_admin" && profile.tenant_id) {
    if (requestedTenantId && requestedTenantId !== profile.tenant_id) {
      return NextResponse.json(
        { error: "غير مصرح برفع ملفات لجهة أخرى" },
        { status: 403 }
      );
    }
    baseFolder = profile.tenant_id;
  } else {
    return NextResponse.json({ error: "غير مصرح بالرفع" }, { status: 403 });
  }

  const objectPath = `${baseFolder}/${folder}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${check.ext}`;

  // Upload using the user's authenticated Supabase session so Storage RLS stays enforced
  const { error: uploadErr } = await supabase.storage
    .from("menus-media")
    .upload(objectPath, buffer, {
      contentType: check.mime,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "تعذر حفظ الصورة، يرجى المحاولة لاحقاً" },
      { status: 400 }
    );
  }

  const { data: urlData } = supabase.storage
    .from("menus-media")
    .getPublicUrl(objectPath);

  return NextResponse.json({
    ok: true,
    url: urlData.publicUrl,
    width: check.width,
    height: check.height,
  });
}
