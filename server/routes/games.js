const express = require('express');
const { body, validationResult } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const GameService = require('../services/gameService');
const ProgressionService = require('../services/progressionService');
const router = express.Router();

// Play Slots
router.post('/slots',
    authenticate,
    body('betAmount').isFloat({ min: 10 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { betAmount } = req.body;
            const result = GameService.playSlots(req.userId, betAmount);
            
            // Add XP
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            
            // Check achievements
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            
            res.json({ 
                ...result,
                xpGained,
                progression,
                achievements
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Play Roulette
router.post('/roulette',
    authenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('betColor').isIn(['red', 'black', 'green']),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { betAmount, betColor } = req.body;
            const result = GameService.playRoulette(req.userId, betAmount, betColor);
            
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            
            res.json({ 
                ...result,
                xpGained,
                progression,
                achievements
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Play Blackjack
router.post('/blackjack',
    authenticate,
    body('action').isIn(['deal', 'hit', 'stand']),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { action, betAmount, gameState } = req.body;
            const result = GameService.playBlackjack(req.userId, betAmount, action, gameState);
            
            let xpGained = 0;
            let progression = null;
            let achievements = [];

            if (action === 'deal') {
                xpGained = Math.floor(betAmount / 10);
                progression = ProgressionService.addXP(req.userId, xpGained);
            } else if (action === 'stand') {
                achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            }
            
            res.json({ 
                ...result,
                xpGained,
                progression,
                achievements
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Verify game fairness
router.post('/verify',
    body('seed').notEmpty(),
    body('hash').notEmpty(),
    (req, res) => {
        try {
            const { seed, hash } = req.body;
            const isValid = GameService.verifyGame(seed, hash);
            
            res.json({ valid: isValid });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

module.exports = router;
