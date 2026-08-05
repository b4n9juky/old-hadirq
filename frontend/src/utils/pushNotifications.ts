function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Browser does not support push notifications');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Service Worker registered');
    return reg;
  } catch (err) {
    console.error('[Push] Service Worker registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function subscribeToPush(
  token: string,
  userId: string,
): Promise<boolean> {
  try {
    console.log('[Push] Starting subscription flow...');
    const permission = await requestNotificationPermission();
    console.log('[Push] Permission:', permission);
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied');
      return false;
    }

    const reg = await registerServiceWorker();
    console.log('[Push] SW registration:', reg?.active?.state || 'null');
    if (!reg) return false;

    const vapidRes = await fetch('/api/push/vapid-public-key', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vapidData = await vapidRes.json();
    console.log('[Push] VAPID response:', vapidData.success, vapidData.data?.publicKey?.substring(0, 20) + '...');
    if (!vapidData.success || !vapidData.data?.publicKey) {
      console.log('[Push] VAPID key not available');
      return false;
    }

    const existingSub = await reg.pushManager.getSubscription();
    console.log('[Push] Existing subscription:', !!existingSub);
    if (existingSub) {
      console.log('[Push] Already subscribed, syncing to server');
      await sendSubscriptionToServer(token, userId, existingSub);
      return true;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidData.data.publicKey).buffer;
    console.log('[Push] Calling PushManager.subscribe...');
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log('[Push] PushManager.subscribe succeeded, endpoint:', subscription.endpoint.substring(0, 50) + '...');
    await sendSubscriptionToServer(token, userId, subscription);
    return true;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return false;
  }
}

async function sendSubscriptionToServer(
  token: string,
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  const subJSON = subscription.toJSON();
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      subscription: {
        endpoint: subscription.endpoint,
        keys: subJSON.keys,
      },
      userAgent: navigator.userAgent,
    }),
  });
  const data = await res.json();
  if (!data.success) {
    console.error('[Push] Server subscribe failed:', data.error);
    throw new Error(data.error || 'Failed to save subscription');
  }
  console.log('[Push] Subscription saved on server');
}

export async function unsubscribeFromPush(
  token: string,
  userId: string,
): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    console.log('[Push] Unsubscribed from push notifications');
    return true;
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
