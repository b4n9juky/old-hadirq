declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys?: { p256dh: string; auth: string };
  }

  interface NotificationPayload {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    image?: string;
    tag?: string;
    renotify?: boolean;
    vibrate?: number[];
    data?: any;
    actions?: Array<{ action: string; title: string; icon?: string }>;
  }

  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: { TTL?: number; urgency?: string; topic?: string }
  ): Promise<SendResult>;
  function generateVapidKeys(): { publicKey: string; privateKey: string };

  export { setVapidDetails, sendNotification, generateVapidKeys, PushSubscription, NotificationPayload, SendResult };
}
