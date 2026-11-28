import { resolveAndVerifyPublicPushEndpoint } from "@/lib/push-security";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushDispatchResult {
  pushMode: "in_app_only" | "web_push_sent" | "vapid_not_configured";
  pushTargeted: number;
  pushSent: number;
  pushFailed: number;
  pushCleaned: number;
}

const PUSH_CONCURRENCY = 10;
const PUSH_TIMEOUT_MS = 5000;

export async function dispatchTenantWebPush(params: {
  admin: SupabaseClient;
  tenantId: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  title: string;
  body: string;
}): Promise<PushDispatchResult> {
  const { admin, tenantId, tenantSlug, tenantName, title, body } = params;

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(500);

  if (subsErr || !subs || subs.length === 0) {
    return {
      pushMode: "in_app_only",
      pushTargeted: 0,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
    };
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    return {
      pushMode: "vapid_not_configured",
      pushTargeted: subs.length,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
    };
  }

  const webPush = await import("web-push").catch(() => null);
  if (!webPush?.default) {
    return {
      pushMode: "vapid_not_configured",
      pushTargeted: subs.length,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
    };
  }

  webPush.default.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@menuz.app",
    vapidPublic,
    vapidPrivate
  );

  const payload = JSON.stringify({
    title: `${tenantName || "مينوز"} — ${title}`,
    body,
    icon: tenantSlug
      ? `/api/manifest/${tenantSlug}/icon?size=192`
      : "/icons/icon-192.png",
    url: tenantSlug ? `/m/${tenantSlug}` : "/",
  });

  let pushSent = 0;
  let pushFailed = 0;
  const staleIds: string[] = [];

  for (let i = 0; i < subs.length; i += PUSH_CONCURRENCY) {
    const chunk = subs.slice(i, i + PUSH_CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (sub) => {
        const isSafeEndpoint = await resolveAndVerifyPublicPushEndpoint(
          sub.endpoint
        );
        if (!isSafeEndpoint) {
          staleIds.push(sub.id);
          pushFailed += 1;
          return;
        }

        try {
          await webPush.default.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { timeout: PUSH_TIMEOUT_MS }
          );
          pushSent += 1;
        } catch (err: unknown) {
          pushFailed += 1;
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          }
        }
      })
    );
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return {
    pushMode: "web_push_sent",
    pushTargeted: subs.length,
    pushSent,
    pushFailed,
    pushCleaned: staleIds.length,
  };
}
