const { db } = require('../config/database');
const logger = require('../config/logger');
let stripe = null;
if ((process.env.PAYMENT_PROVIDER || '').toLowerCase() === 'stripe' && process.env.STRIPE_SECRET_KEY) {
    try {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    } catch (e) {
        logger.error('Failed to init Stripe SDK', { error: e.message });
    }
}

class PaymentService {
    static createDepositIntent(userId, amount, currency = 'USD') {
        if (!process.env.REAL_MONEY_MODE || process.env.REAL_MONEY_MODE === 'false') {
            throw new Error('Real money mode is disabled');
        }
        if (amount <= 0) throw new Error('Amount must be positive');

        const provider = (process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();

        if (provider === 'stripe' && stripe) {
          return this._createStripeIntent(userId, amount, currency);
        }

        // Stub fallback
        const clientSecret = `stub_${Math.random().toString(36).slice(2)}`;
        const stmt = db.prepare(`
                INSERT INTO payment_intents (user_id, provider, amount, currency, status, client_secret, raw_response)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
        const result = stmt.run(userId, provider, amount, currency, 'created', clientSecret, JSON.stringify({ clientSecret }));

        logger.info(`Payment intent created (stub): user=${userId}, amount=${amount} ${currency}, provider=${provider}`);
        return { id: result.lastInsertRowid, clientSecret };
    }

    static recordWebhook(provider, payload) {
        try {
            const externalId = payload.id || null;
            const status = payload.status || 'pending';
            const clientSecret = payload.client_secret || null;
            const amount = payload.amount || 0;
            const currency = payload.currency || 'USD';

            // attempt upsert by external id if provided
            if (externalId) {
                const existing = db.prepare('SELECT id FROM payment_intents WHERE external_id = ?').get(externalId);
                if (existing) {
                    db.prepare(`UPDATE payment_intents SET status = ?, raw_response = ?, updated_at = ? WHERE id = ?`)
                      .run(status, JSON.stringify(payload), Date.now(), existing.id);
                    return { updated: true };
                }
            }

            const stmt = db.prepare(`
                INSERT INTO payment_intents (user_id, provider, external_id, amount, currency, status, client_secret, raw_response)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(null, provider, externalId, amount, currency, status, clientSecret, JSON.stringify(payload));
            return { created: true };
        } catch (e) {
            logger.error('Failed to record payment webhook', { error: e.message });
            throw e;
        }
    }
}

module.exports = PaymentService;
 
// Private helpers
PaymentService._createStripeIntent = function(userId, amount, currency) {
    return (async () => {
        const cents = Math.round(amount * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: cents,
            currency: currency.toLowerCase(),
            metadata: { userId: String(userId) }
        });
        const stmt = db.prepare(`
            INSERT INTO payment_intents (user_id, provider, external_id, amount, currency, status, client_secret, raw_response)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(userId, 'stripe', paymentIntent.id, amount, currency.toUpperCase(), paymentIntent.status, paymentIntent.client_secret, JSON.stringify(paymentIntent));
        logger.info(`Stripe intent created: user=${userId}, id=${paymentIntent.id}, amount=${amount} ${currency}`);
        return { id: paymentIntent.id, clientSecret: paymentIntent.client_secret };
    })();
};
