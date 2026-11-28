import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  decodeAndSanitizeImage,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@/lib/image-validation";
import {
  buildRateLimitKey,
  enforceRateLimit,
  getRateLimitIdentifier,
  verifySameOrigin,
  writeAuditLog,
} from "@/lib/security";

const ALLOWED_FOLDERS = new Set(["item", "wallet", "logo", "cover"]);
const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024; // 256 KiB multipart fields/headers headroom
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  // Reject oversized request bodies early before reading FormData
  const rawLength = request.headers.get("content-length");
  if (rawLength) {
    const contentLength = Number(rawLength);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_IMAGE_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
    ) {
      return NextResponse.json(
        { error: "حجم الطلب يتجاوز الحد الأقصى المسموح (4 ميجابايت)" },
        { status: 413 }
      );
    }
  }

  // 1. Pre-auth rate limit using anti-spoofing IP/fingerprint identifier
  const clientIdent = getRateLimitIdentifier(request);
  const ipRl = await enforceRateLimit(
    buildRateLimitKey("upload-ip", clientIdent),
    40,
    600
  );
  if (ipRl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز حد محاولات الرفع من هذا العنوان، يرجى الانتظار" },
      { status: 429 }
    );
  }
  if (ipRl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً، يرجى المحاولة بعد قليل" },
      { status: 503 }
    );
  }

  // 2. Authenticate user session
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  let userId: string;
  let userEmail: string | null = null;

  try {
    supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }
    userId = user.id;
    userEmail = user.email ?? null;
  } catch {
    return NextResponse.json(
      { error: "خدمة التحقق من الهوية غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  // 3. Per-user rate limit BEFORE querying profile/storage
  const userRl = await enforceRateLimit(
    buildRateLimitKey("upload-user", userId),
    30,
    600
  );
  if (userRl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز حد رفع الصور المؤقت للحساب، يرجى الانتظار" },
      { status: 429 }
    );
  }
  if (userRl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  // 4. Read profile only after auth + rate limits succeed
  let profile: { role: string; tenant_id: string | null } | null = null;
  try {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", userId)
      .single();
    profile = profileData;
  } catch {
    return NextResponse.json(
      { error: "خدمة التحقق من الصلاحيات غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "بيانات الرفع غير صالحة" }, { status: 400 });
  }

  const file = formData.get("file");
  const rawFolder = String(formData.get("folder") || "item")
    .trim()
    .toLowerCase();
  const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "item";
  const requestedTenantId = String(formData.get("tenantId") || "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "يرجى إرفاق ملف صورة صالح" },
      { status: 400 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "حجم الصورة يتجاوز الحد المسموح (4 ميجابايت)" },
      { status: 413 }
    );
  }

  let baseFolder: string;
  if (profile.role === "super_admin") {
    if (requestedTenantId) {
      if (!UUID_RE.test(requestedTenantId)) {
        return NextResponse.json(
          { error: "معرف الجهة غير صالح" },
          { status: 400 }
        );
      }
      const { data: targetTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("id", requestedTenantId)
        .maybeSingle();
      if (!targetTenant) {
        return NextResponse.json(
          { error: "الجهة المحددة غير موجودة" },
          { status: 404 }
        );
      }
      baseFolder = requestedTenantId;
    } else {
      baseFolder = "super-admin";
    }
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

  // 5. Server-side full image decode, pixel-limit enforcement, metadata strip & WebP re-encode
  const arrayBuffer = await file.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const sanitized = await decodeAndSanitizeImage(rawBuffer);
  if (!sanitized.valid || !sanitized.buffer || !sanitized.mime || !sanitized.ext) {
    return NextResponse.json(
      { error: sanitized.error || "ملف الصورة غير صالح" },
      { status: 400 }
    );
  }

  const objectPath = `${baseFolder}/${folder}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${sanitized.ext}`;

  // Upload from server ONLY after all auth, tenant-ownership, rate-limit, and sharp checks pass.
  // Service Role remains strictly server-side, allowing Storage to block direct client uploads.
  try {
    const admin = createAdminSupabase();
    const { error: uploadErr } = await admin.storage
      .from("menus-media")
      .upload(objectPath, sanitized.buffer, {
        contentType: sanitized.mime,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: "تعذر حفظ الصورة، يرجى المحاولة لاحقاً" },
        { status: 400 }
      );
    }

    const { data: urlData } = admin.storage
      .from("menus-media")
      .getPublicUrl(objectPath);

    await writeAuditLog({
      actorId: userId,
      actorEmail: userEmail,
      action: "media_upload",
      targetType: "storage_object",
      targetId: objectPath,
      details: {
        folder,
        tenantFolder: baseFolder,
        bytes: sanitized.buffer.length,
        width: sanitized.width,
        height: sanitized.height,
      },
    });

    return NextResponse.json({
      ok: true,
      url: urlData.publicUrl,
      path: objectPath,
      width: sanitized.width,
      height: sanitized.height,
    });
  } catch {
    return NextResponse.json(
      { error: "خدمة التخزين غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "طلب غير مصرح به" }, { status: 403 });
  }

  const clientIdent = getRateLimitIdentifier(request);
  const ipRl = await enforceRateLimit(
    buildRateLimitKey("media-del-ip", clientIdent),
    30,
    600
  );
  if (ipRl.status === "rate_limited") {
    return NextResponse.json(
      { error: "تم تجاوز حد الطلبات مؤقتاً" },
      { status: 429 }
    );
  }
  if (ipRl.status === "unavailable") {
    return NextResponse.json(
      { error: "خدمة التحقق الأمني غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  let userId: string;
  let userEmail: string | null = null;
  try {
    supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }
    userId = user.id;
    userEmail = user.email ?? null;
  } catch {
    return NextResponse.json(
      { error: "خدمة التحقق من الهوية غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawPath = String(body?.path || "").trim();
  if (!rawPath || rawPath.includes("..") || rawPath.startsWith("/") || rawPath.length > 300) {
    return NextResponse.json({ error: "مسار الملف غير صالح" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  if (profile.role === "client_admin") {
    if (!profile.tenant_id || !rawPath.startsWith(`${profile.tenant_id}/`)) {
      return NextResponse.json(
        { error: "غير مصرح بحذف ملفات جهة أخرى" },
        { status: 403 }
      );
    }
  } else if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const admin = createAdminSupabase();
    const { error } = await admin.storage.from("menus-media").remove([rawPath]);
    if (error) {
      return NextResponse.json({ error: "تعذر حذف الملف" }, { status: 400 });
    }
    await writeAuditLog({
      actorId: userId,
      actorEmail: userEmail,
      action: "media_delete",
      targetType: "storage_object",
      targetId: rawPath,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "خدمة التخزين غير متاحة مؤقتاً" },
      { status: 503 }
    );
  }
}
