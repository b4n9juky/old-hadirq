import webPush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions, user } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@presensimipi.web.id';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

class PushService {
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  isConfigured(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  }

  async subscribe(userId: string, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }, userAgent?: string) {
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .limit(100);

    const alreadyExists = existing.find(s => s.endpoint === subscription.endpoint);
    if (alreadyExists) return alreadyExists;

    if (existing.length >= 3) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, existing[0].id));
    }

    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
    });

    const inserted = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    return inserted[0] || null;
  }

  async unsubscribe(userId: string, endpoint: string) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    const sub = subs.find(s => s.endpoint === endpoint);
    if (!sub) return false;

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    return true;
  }

  async getSubscriptionsByUserId(userId: string) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async getSubscriptionCount() {
    const [result] = await db
      .select({ count: pushSubscriptions.id })
      .from(pushSubscriptions);
    return result ? 1 : 0;
  }

  async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; url?: string }
  ): Promise<{ sent: number; failed: number }> {
    if (!this.isConfigured()) {
      console.log('[Push] VAPID keys not configured, skipping push');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.getSubscriptionsByUserId(userId);
    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard/orang-tua',
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload
        );
        sent++;
      } catch (err: any) {
        console.log(`[Push] Failed to send to ${sub.endpoint}: ${err.message}`);
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Push] Removing expired subscription ${sub.id}`);
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
        failed++;
      }
    }

    return { sent, failed };
  }
}

export const pushService = new PushService();
