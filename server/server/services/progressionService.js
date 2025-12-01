const { db } = require('../config/database');
const logger = require('../config/logger');

class ProgressionService {
    static addXP(userId, amount) {
        return db.transaction(() => {
            const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId);
            const newXP = user.xp + amount;
            const newLevel = Math.floor(newXP / 1000) + 1;

            db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXP, newLevel, userId);

            if (newLevel > user.level) {
                // Level up bonus
                const bonus = newLevel * 100;
                const WalletService = require('./walletService');
                WalletService.updateBalance(userId, bonus, 'level_up', { level: newLevel, bonus });
                
                logger.info(`User ${userId} leveled up to ${newLevel}`);
                return { leveledUp: true, newLevel, bonus };
            }

            return { leveledUp: false, xp: newXP, level: newLevel };
        })();
    }

    static unlockAchievement(userId, achievementKey, title, description) {
        try {
            db.prepare(`
                INSERT INTO achievements (user_id, achievement_key, title, description)
                VALUES (?, ?, ?, ?)
            `).run(userId, achievementKey, title, description);

            logger.info(`Achievement unlocked: ${achievementKey} for user ${userId}`);
            return true;
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return false; // Already unlocked
            }
            throw error;
        }
    }

    static getAchievements(userId) {
        return db.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(userId);
    }

    static checkAndUnlockAchievements(userId) {
        const unlocked = [];

        // Get game stats
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_games,
                SUM(CASE WHEN outcome IN ('win', 'jackpot') THEN 1 ELSE 0 END) as total_wins,
                MAX(win_amount) as biggest_win,
                SUM(profit) as net_profit
            FROM game_results
            WHERE user_id = ?
        `).get(userId);

        // First win
        if (stats.total_wins === 1) {
            if (this.unlockAchievement(userId, 'first_win', 'First Victory', 'Won your first game')) {
                unlocked.push({ key: 'first_win', title: 'First Victory' });
            }
        }

        // 10 wins
        if (stats.total_wins === 10) {
            if (this.unlockAchievement(userId, 'winning_streak', 'On a Roll', 'Won 10 games')) {
                unlocked.push({ key: 'winning_streak', title: 'On a Roll' });
            }
        }

        // 50 wins
        if (stats.total_wins === 50) {
            if (this.unlockAchievement(userId, 'pro_player', 'Professional', 'Won 50 games')) {
                unlocked.push({ key: 'pro_player', title: 'Professional' });
            }
        }

        // Big win
        if (stats.biggest_win >= 5000) {
            if (this.unlockAchievement(userId, 'big_win', 'Big Winner', 'Won $5,000+ in a single game')) {
                unlocked.push({ key: 'big_win', title: 'Big Winner' });
            }
        }

        // Check game-specific achievements
        ['slots', 'roulette', 'blackjack'].forEach(game => {
            const gameCount = db.prepare('SELECT COUNT(*) as count FROM game_results WHERE user_id = ? AND game = ?').get(userId, game);
            if (gameCount.count === 20) {
                if (this.unlockAchievement(userId, `${game}_master`, `${game} Master`, `Played ${game} 20 times`)) {
                    unlocked.push({ key: `${game}_master`, title: `${game} Master` });
                }
            }
        });

        return unlocked;
    }

    static claimDailyBonus(userId) {
        return db.transaction(() => {
            const streak = db.prepare('SELECT * FROM daily_streaks WHERE user_id = ?').get(userId);
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            if (streak.last_claim && (now - streak.last_claim) < oneDayMs) {
                throw new Error('Daily bonus already claimed');
            }

            // Update streak
            const daysSinceLastClaim = streak.last_claim ? Math.floor((now - streak.last_claim) / oneDayMs) : 999;
            const newStreak = daysSinceLastClaim === 1 ? streak.current_streak + 1 : 1;

            db.prepare('UPDATE daily_streaks SET current_streak = ?, last_claim = ? WHERE user_id = ?')
                .run(newStreak, now, userId);

            // Calculate bonus (base + streak bonus)
            const baseBonus = parseFloat(process.env.DAILY_BONUS_AMOUNT) || 500;
            const streakBonus = Math.min(newStreak * 50, 500); // Max 500 bonus
            const totalBonus = baseBonus + streakBonus;

            const WalletService = require('./walletService');
            const newBalance = WalletService.updateBalance(userId, totalBonus, 'daily_bonus', { streak: newStreak });

            logger.info(`Daily bonus claimed: User ${userId}, Streak: ${newStreak}, Bonus: ${totalBonus}`);

            return { bonus: totalBonus, streak: newStreak, balance: newBalance };
        })();
    }

    static getStreak(userId) {
        return db.prepare('SELECT * FROM daily_streaks WHERE user_id = ?').get(userId);
    }
}

module.exports = ProgressionService;
