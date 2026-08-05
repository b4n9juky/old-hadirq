import { Router, Request, Response } from 'express';
import { pushService } from '../services/pushService.js';

export const pushRouter = Router();

pushRouter.get('/vapid-public-key', (_req: Request, res: Response) => {
  const key = pushService.getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ success: false, error: 'Push notifications not configured' });
  }
  res.json({ success: true, data: { publicKey: key } });
});

pushRouter.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const uid = req.context?.user?.id;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { subscription, userAgent } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription data' });
    }

    console.log(`[Push] Subscribe request from user ${uid}`);
    const result = await pushService.subscribe(uid, subscription, userAgent);
    console.log(`[Push] Subscription stored for user ${uid}, id=${result?.id}`);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

pushRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const uid = req.context?.user?.id;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Endpoint required' });
    }

    const removed = await pushService.unsubscribe(uid, endpoint);
    res.json({ success: true, data: { removed } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

pushRouter.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const uid = req.context?.user?.id;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const subs = await pushService.getSubscriptionsByUserId(uid);
    res.json({ success: true, data: { count: subs.length, subscriptions: subs } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin endpoint: get total subscription count
pushRouter.get('/admin/count', async (req: Request, res: Response) => {
  try {
    const count = await pushService.getSubscriptionCount();
    res.json({ success: true, data: { count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default pushRouter;
