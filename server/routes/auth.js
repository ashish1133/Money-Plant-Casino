const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const router = express.Router();

// Register
router.post('/register',
    body('username').isLength({ min: 3, max: 20 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, password } = req.body;
            const result = await AuthService.register(username, email, password);
            
            res.status(201).json({
                message: 'User registered successfully',
                user: result
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Login
router.post('/login',
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, password } = req.body;
            const result = await AuthService.login(username, password);
            
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
);

// Refresh token
router.post('/refresh',
    body('refreshToken').notEmpty(),
    async (req, res) => {
        try {
            const { refreshToken } = req.body;
            const result = await AuthService.refresh(refreshToken);
            
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
);

// Logout
router.post('/logout',
    body('refreshToken').notEmpty(),
    async (req, res) => {
        try {
            const { refreshToken } = req.body;
            await AuthService.logout(refreshToken);
            
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

module.exports = router;
