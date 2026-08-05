import { Router } from 'express';
import { pushService } from '../services/pushService.js';

export const pushRouter = Router();

pushRouter.get('/vapid-public-key', (_req, res) => {
  const key = pushService.getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ success: false, error: 'Push notifications not configured' });
  }
  res.json({ success: true, data: { publicKey: key } });
});

pushRouter.post('/subscribe', async (req, res) => {
  try {
    const { userId } = (req as any).session || (req as any).user || {};
    const uid = userId || req.body?.userId;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { subscription, userAgent } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription data' });
    }

    const result = await pushService.subscribe(uid, subscription, userAgent);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

pushRouter.post('/unsubscribe', async (req, res) => {
  try {
    const { userId } = (req as any).session || (req as any).user || {};
    const uid = userId || req.body?.userId;
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

pushRouter.get('/subscriptions', async (req, res) => {
  try {
    const { userId } = (req as any).session || (req as any).user || {};
    const uid = userId || (req.query as any)?.userId;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const subs = await pushService.getSubscriptionsByUserId(uid);
    res.json({ success: true, data: { count: subs.length, subscriptions: subs } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default pushRouter;
