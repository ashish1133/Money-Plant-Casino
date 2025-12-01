const express = require('express');
const { body, validationResult } = require('express-validator');
const firebaseAuthenticate = require('../middleware/firebaseAuthenticate');
const kycRequired = require('../middleware/kycRequired');
const PaymentService = require('../services/paymentService');
const router = express.Router();

// Create deposit intent (client obtains provider clientSecret)
router.post('/deposit-intent',
    firebaseAuthenticate,
    kycRequired,
    body('amount').isFloat({ gt: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { amount, currency = 'USD' } = req.body;
            const intent = await PaymentService.createDepositIntent(req.userId, parseFloat(amount), currency);
            res.json({ intent });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

module.exports = router;
