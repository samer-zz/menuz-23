import {
  verifyPublicPushEndpoint,
  type EndpointVerificationResult,
} from "@/lib/push-security";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushMode =
  | "no_subscribers"
  | "web_push_sent"
  | "web_push_partial"
  | "web_push_failed"
  | "vapid_not_configured"
  | "dispatch_error";

export interface PushDispatchResult {
  pushMode: PushMode;
  pushTargeted: number;
  pushSent: number;
  pushFailed: number;
  pushCleaned: number;
  alreadySentCount: number;
  lastError?: string | null;
}

export type SendWebPushFn = (
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: string,
  options: { timeout: number }
) => Promise<unknown>;

const PUSH_CONCURRENCY = 10;
const PUSH_TIMEOUT_MS = 5000;

export function isValidVapidSubject(subject: string | undefined): boolean {
  if (!subject) return false;
  const trimmed = subject.trim();
  return trimmed.startsWith("mailto:") || trimmed.startsWith("https://");
}

export async function dispatchTenantWebPush(params: {
  admin: SupabaseClient;
  tenantId: string;
  notificationId?: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  title: string;
  body: string;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string }>>;
  sendPushFn?: SendWebPushFn;
}): Promise<PushDispatchResult> {
  const {
    admin,
    tenantId,
    notificationId,
    tenantSlug,
    tenantName,
    title,
    body,
    lookupFn,
    sendPushFn,
  } = params;

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(500);

  if (subsErr) {
    return {
      pushMode: "dispatch_error",
      pushTargeted: 0,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
      alreadySentCount: 0,
      lastError: subsErr.message || "Failed to query push subscriptions",
    };
  }

  const activeSubs = subs ?? [];
  if (activeSubs.length === 0) {
    return {
      pushMode: "no_subscribers",
      pushTargeted: 0,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
      alreadySentCount: 0,
      lastError: null,
    };
  }

  // Skip subscribers already successfully delivered for this notification (safe retry)
  let alreadySentIds = new Set<string>();
  if (notificationId) {
    const { data: priorDeliveries } = await admin
      .from("notification_push_deliveries")
      .select("subscription_id")
      .eq("notification_id", notificationId)
      .eq("status", "sent");

    if (priorDeliveries && priorDeliveries.length > 0) {
      alreadySentIds = new Set(
        priorDeliveries.map((d) => String(d.subscription_id))
      );
    }
  }

  const pendingSubs = activeSubs.filter((s) => !alreadySentIds.has(s.id));
  if (pendingSubs.length === 0) {
    return {
      pushMode: "web_push_sent",
      pushTargeted: 0,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
      alreadySentCount: alreadySentIds.size,
      lastError: null,
    };
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapidSubject = (
    process.env.VAPID_SUBJECT || "mailto:admin@menuz.app"
  ).trim();

  if (!vapidPublic || !vapidPrivate || !isValidVapidSubject(vapidSubject)) {
    return {
      pushMode: "vapid_not_configured",
      pushTargeted: pendingSubs.length,
      pushSent: 0,
      pushFailed: 0,
      pushCleaned: 0,
      alreadySentCount: alreadySentIds.size,
      lastError: "VAPID keys or subject not configured",
    };
  }

  let effectiveSend: SendWebPushFn | undefined = sendPushFn;
  if (!effectiveSend) {
    const webPush = await import("web-push").catch(() => null);
    if (!webPush?.default) {
      return {
        pushMode: "vapid_not_configured",
        pushTargeted: pendingSubs.length,
        pushSent: 0,
        pushFailed: 0,
        pushCleaned: 0,
        alreadySentCount: alreadySentIds.size,
        lastError: "web-push runtime unavailable",
      };
    }
    try {
      webPush.default.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    } catch {
      return {
        pushMode: "dispatch_error",
        pushTargeted: pendingSubs.length,
        pushSent: 0,
        pushFailed: pendingSubs.length,
        pushCleaned: 0,
        alreadySentCount: alreadySentIds.size,
        lastError: "Invalid VAPID configuration",
      };
    }
    effectiveSend = (sub, payloadStr, opts) =>
      webPush.default.sendNotification(sub, payloadStr, opts);
  }

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
  let lastError: string | null = null;
  const staleIds: string[] = [];
  const deliveryRows: Array<{
    notification_id: string;
    subscription_id: string;
    status: "sent" | "failed";
    last_error: string | null;
    updated_at: string;
  }> = [];

  for (let i = 0; i < pendingSubs.length; i += PUSH_CONCURRENCY) {
    const chunk = pendingSubs.slice(i, i + PUSH_CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (sub) => {
        const verif: EndpointVerificationResult =
          await verifyPublicPushEndpoint(sub.endpoint, lookupFn);

        if (!verif.ok) {
          pushFailed += 1;
          lastError = verif.reason;
          if (verif.permanent) {
            // Only remove permanently unsafe/invalid endpoints (SSRF/private IP/invalid URL)
            staleIds.push(sub.id);
          } else if (notificationId) {
            // Transient DNS failure (SERVFAIL/EAI_AGAIN/Timeout): keep subscription intact for retry
            deliveryRows.push({
              notification_id: notificationId,
              subscription_id: sub.id,
              status: "failed",
              last_error: "dns_transient_error",
              updated_at: new Date().toISOString(),
            });
          }
          return;
        }

        try {
          await effectiveSend!(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { timeout: PUSH_TIMEOUT_MS }
          );
          pushSent += 1;
          if (notificationId) {
            deliveryRows.push({
              notification_id: notificationId,
              subscription_id: sub.id,
              status: "sent",
              last_error: null,
              updated_at: new Date().toISOString(),
            });
          }
        } catch (err: unknown) {
          pushFailed += 1;
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;

          if (statusCode === 404 || statusCode === 410) {
            // Permanent subscription expiration/removal per Web Push spec
            staleIds.push(sub.id);
            lastError = `http_${statusCode}`;
          } else {
            lastError = statusCode ? `http_${statusCode}` : "push_send_error";
            if (notificationId) {
              deliveryRows.push({
                notification_id: notificationId,
                subscription_id: sub.id,
                status: "failed",
                last_error: lastError,
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      })
    );
  }

  if (notificationId && deliveryRows.length > 0) {
    // Best-effort per-subscription tracking (ignore cleanly if migration 006 not applied)
    await admin
      .from("notification_push_deliveries")
      .upsert(deliveryRows, { onConflict: "notification_id,subscription_id" })
      .then(() => undefined, () => undefined);
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  let pushMode: PushMode;
  if (pushSent > 0 && pushFailed === 0) {
    pushMode = "web_push_sent";
  } else if (pushSent > 0 && pushFailed > 0) {
    pushMode = "web_push_partial";
  } else if (pushSent === 0 && pushFailed > 0) {
    pushMode = "web_push_failed";
  } else {
    pushMode = "no_subscribers";
  }

  return {
    pushMode,
    pushTargeted: pendingSubs.length,
    pushSent,
    pushFailed,
    pushCleaned: staleIds.length,
    alreadySentCount: alreadySentIds.size,
    lastError,
  };
}

export async function persistNotificationPushOutcome(
  admin: SupabaseClient,
  notificationId: string,
  dispatch: PushDispatchResult,
  currentAttempts = 0
): Promise<void> {
  const nowIso = new Date().toISOString();
  let updateData: Record<string, unknown>;

  if (dispatch.pushMode === "web_push_sent") {
    updateData = {
      push_sent: true,
      push_status: "sent",
      push_attempts: currentAttempts + 1,
      push_last_attempt_at: nowIso,
      push_sent_at: nowIso,
      push_last_error: null,
    };
  } else if (dispatch.pushMode === "web_push_partial") {
    updateData = {
      push_sent: false,
      push_status: "partial",
      push_attempts: currentAttempts + 1,
      push_last_attempt_at: nowIso,
      push_last_error: dispatch.lastError || "partial_delivery_failure",
    };
  } else if (
    dispatch.pushMode === "web_push_failed" ||
    dispatch.pushMode === "dispatch_error"
  ) {
    updateData = {
      push_sent: false,
      push_status: "failed",
      push_attempts: currentAttempts + 1,
      push_last_attempt_at: nowIso,
      push_last_error: dispatch.lastError || "push_dispatch_failed",
    };
  } else if (dispatch.pushMode === "vapid_not_configured") {
    updateData = {
      push_sent: false,
      push_status: "vapid_not_configured",
      push_last_attempt_at: nowIso,
      push_last_error: "VAPID keys not configured",
    };
  } else {
    updateData = {
      push_sent: false,
      push_status: "no_subscribers",
      push_last_attempt_at: nowIso,
      push_last_error: null,
    };
  }

  const { error } = await admin
    .from("notifications")
    .update(updateData)
    .eq("id", notificationId);

  // Graceful fallback if migration 006 columns are not yet present in DB
  if (error && /column .* does not exist/i.test(error.message)) {
    await admin
      .from("notifications")
      .update({ push_sent: dispatch.pushMode === "web_push_sent" })
      .eq("id", notificationId);
  }
}
