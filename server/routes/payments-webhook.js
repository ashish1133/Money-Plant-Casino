const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const logger = require('../config/logger');

// Stripe signature verification
let stripe = null;
if ((process.env.PAYMENT_PROVIDER || '').toLowerCase() === 'stripe' && process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch (e) {
    logger.error('Failed to init Stripe for webhook', { error: e.message });
  }
}

router.post('/', express.raw({ type: '*/*' }), (req, res) => {
  try {
    const provider = (req.query.provider || process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();

    if (provider === 'stripe' && stripe) {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET' });
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }
      PaymentService.recordWebhook('stripe', event);
      return res.json({ received: true });
    }

    // Stub fallback
    const secret = req.headers['x-webhook-secret'] || '';
    if (!process.env.PAYMENT_WEBHOOK_SECRET || secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
    const payloadText = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
    const payload = JSON.parse(payloadText || '{}');
    const result = PaymentService.recordWebhook(provider, payload);
    res.json({ received: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
