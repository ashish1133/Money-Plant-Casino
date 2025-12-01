const express = require('express');
const { body, validationResult } = require('express-validator');
const firebaseAuthenticate = require('../middleware/firebaseAuthenticate');
const GameService = require('../services/gameService');
const ProgressionService = require('../services/progressionService');
const router = express.Router();

// Play Slots
router.post('/slots',
    firebaseAuthenticate,
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
    firebaseAuthenticate,
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
    firebaseAuthenticate,
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

// Dice (roll-under)
router.post('/dice',
    firebaseAuthenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('target').isInt({ min: 2, max: 98 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { betAmount, target } = req.body;
            const result = GameService.playDice(req.userId, parseFloat(betAmount), parseInt(target, 10));
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            res.json({ ...result, xpGained, progression, achievements });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Plinko
router.post('/plinko',
    firebaseAuthenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('rows').optional().isInt({ min: 6, max: 16 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { betAmount, rows } = req.body;
            const result = GameService.playPlinko(req.userId, parseFloat(betAmount), rows ? parseInt(rows, 10) : 8);
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            res.json({ ...result, xpGained, progression, achievements });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Limbo
router.post('/limbo',
    firebaseAuthenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('target').isFloat({ min: 1.01, max: 1000 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            const { betAmount, target } = req.body;
            const result = GameService.playLimbo(req.userId, parseFloat(betAmount), parseFloat(target));
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            res.json({ ...result, xpGained, progression, achievements });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

// Mines (one-shot quick game)
router.post('/mines',
    firebaseAuthenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('bombs').isInt({ min: 1, max: 24 }),
    body('picks').isInt({ min: 1, max: 24 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            const { betAmount, bombs, picks } = req.body;
            const result = GameService.playMines(req.userId, parseFloat(betAmount), parseInt(bombs, 10), parseInt(picks, 10));
            const xpGained = Math.floor(betAmount / 10);
            const progression = ProgressionService.addXP(req.userId, xpGained);
            const achievements = ProgressionService.checkAndUnlockAchievements(req.userId);
            res.json({ ...result, xpGained, progression, achievements });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
);

module.exports = router;
// Crash (Aviator-style with auto cashout)
router.post('/crash',
    firebaseAuthenticate,
    body('betAmount').isFloat({ min: 10 }),
    body('autoCashout').isFloat({ min: 1.01 }),
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { betAmount, autoCashout } = req.body;
            const result = GameService.playCrash(req.userId, parseFloat(betAmount), parseFloat(autoCashout));

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

// Games catalog (grouped, with metadata)
router.get('/catalog', (req, res) => {
    const edge = {
        slots: 0.03,
        roulette: 0.02,
        blackjack: 0.01,
        crash: parseFloat(process.env.CRASH_HOUSE_EDGE || '0.01'),
        dice: parseFloat(process.env.DICE_HOUSE_EDGE || '0.01'),
        plinko: parseFloat(process.env.PLINKO_HOUSE_EDGE || '0.02'),
        limbo: parseFloat(process.env.LIMBO_HOUSE_EDGE || '0.01'),
        mines: parseFloat(process.env.MINES_HOUSE_EDGE || '0.02')
    };
    const g = (key, name, type, route, params = {}) => ({ key, name, type, route, edge: edge[key] ?? null, params });
    res.json({
        categories: [
            {
                key: 'featured',
                title: 'Featured',
                games: [
                    g('slots','Lucky Slots','slots','/api/games/slots'),
                    g('roulette','Roulette','table','/api/games/roulette'),
                    g('crash','Crash','crash','/api/games/crash', { autoCashout: { min: 1.01, max: parseFloat(process.env.CRASH_MAX_CASHOUT || '100') }})
                ]
            },
            {
                key: 'table',
                title: 'Table Games',
                games: [
                    g('blackjack','Blackjack','table','/api/games/blackjack'),
                    g('roulette','Roulette','table','/api/games/roulette'),
                    { key: 'baccarat', name: 'Baccarat (coming soon)', type: 'table', comingSoon: true }
                ]
            },
            {
                key: 'arcade',
                title: 'Arcade',
                games: [
                    g('crash','Crash','crash','/api/games/crash'),
                    g('dice','Dice','arcade','/api/games/dice', { target: { min: 2, max: 98 }}),
                    g('plinko','Plinko','arcade','/api/games/plinko', { rows: { min: 6, max: 16 }}),
                    g('limbo','Limbo','arcade','/api/games/limbo', { target: { min: 1.01, max: 1000 }}),
                    g('mines','Mines','arcade','/api/games/mines', { bombs: { min: 1, max: 24 }, picks: { min: 1, max: 24 }})
                ]
            },
            {
                key: 'live',
                title: 'Live Casino',
                games: [
                    { key: 'live-roulette', name: 'Live Roulette (provider req.)', type: 'live', provider: 'external', comingSoon: true },
                    { key: 'crazy-time', name: 'Game Show (provider req.)', type: 'live', provider: 'external', comingSoon: true }
                ]
            }
        ]
    });
});
