const express = require('express');
const { body, validationResult } = require('express-validator');
const firebaseAuthenticate = require('../middleware/firebaseAuthenticate');
const WalletService = require('../services/walletService');
const kycRequired = require('../middleware/kycRequired');
const router = express.Router();

// Get balance
router.get('/balance', firebaseAuthenticate, (req, res) => {
    try {
        const balance = WalletService.getBalance(req.userId);
        res.json({ balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get transactions
router.get('/transactions', firebaseAuthenticate, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const transactions = WalletService.getTransactions(req.userId, limit, offset);
        res.json({ transactions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deposit
router.post('/deposit',
    firebaseAuthenticate,
    kycRequired,
    body('amount').isFloat({ min: 10 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { amount } = req.body;
            const newBalance = WalletService.deposit(req.userId, amount);
            
            res.json({ 
                message: 'Deposit successful',
                balance: newBalance
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Withdraw
router.post('/withdraw',
    firebaseAuthenticate,
    kycRequired,
    body('amount').isFloat({ min: 10 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { amount } = req.body;
            const newBalance = WalletService.withdraw(req.userId, amount);
            
            res.json({ 
                message: 'Withdrawal successful',
                balance: newBalance
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

module.exports = router;
