const express = require('express');
const firebaseAuthenticate = require('../middleware/firebaseAuthenticate');
const ProgressionService = require('../services/progressionService');
const LeaderboardService = require('../services/leaderboardService');
const { db } = require('../config/database');
const router = express.Router();

// Get user profile
router.get('/profile', firebaseAuthenticate, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT u.id, u.username, u.email, u.level, u.xp, b.amount as balance
            FROM users u
            LEFT JOIN balances b ON u.id = b.user_id
            WHERE u.id = ?
        `).get(req.userId);

        const achievements = ProgressionService.getAchievements(req.userId);
        const streak = ProgressionService.getStreak(req.userId);
        const rank = LeaderboardService.getUserRank(req.userId);

        res.json({
            user: {
                ...user,
                achievements: achievements.length,
                streak: streak.current_streak,
                rank
            },
            achievements,
            streak
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get achievements
router.get('/achievements', firebaseAuthenticate, (req, res) => {
    try {
        const achievements = ProgressionService.getAchievements(req.userId);
        res.json({ achievements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Claim daily bonus
router.post('/daily-bonus', firebaseAuthenticate, (req, res) => {
    try {
        const result = ProgressionService.claimDailyBonus(req.userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get leaderboard
router.get('/leaderboard', (req, res) => {
    try {
        const type = req.query.type || 'profit';
        const game = req.query.game;
        const limit = parseInt(req.query.limit) || 10;

        let leaderboard;
        if (game) {
            leaderboard = LeaderboardService.getGameLeaderboard(game, limit);
        } else if (type === 'level') {
            leaderboard = LeaderboardService.getTopByLevel(limit);
        } else {
            leaderboard = LeaderboardService.getTopPlayers(limit);
        }

        res.json({ leaderboard });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user stats
router.get('/stats', firebaseAuthenticate, (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_games,
                SUM(CASE WHEN outcome IN ('win', 'jackpot') THEN 1 ELSE 0 END) as total_wins,
                SUM(bet_amount) as total_wagered,
                SUM(win_amount) as total_won,
                SUM(profit) as net_profit,
                MAX(win_amount) as biggest_win,
                AVG(bet_amount) as avg_bet
            FROM game_results
            WHERE user_id = ?
        `).get(req.userId);

        const gameBreakdown = db.prepare(`
            SELECT 
                game,
                COUNT(*) as plays,
                SUM(CASE WHEN outcome IN ('win', 'jackpot') THEN 1 ELSE 0 END) as wins,
                SUM(profit) as profit
            FROM game_results
            WHERE user_id = ?
            GROUP BY game
        `).all(req.userId);

        res.json({ 
            stats: {
                ...stats,
                winRate: stats.total_games > 0 ? (stats.total_wins / stats.total_games * 100).toFixed(2) : 0
            },
            gameBreakdown
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
