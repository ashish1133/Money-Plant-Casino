const { db } = require('../config/database');

class LeaderboardService {
    static getTopPlayers(limit = 10) {
        return db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.level,
                b.amount as balance,
                (SELECT SUM(profit) FROM game_results WHERE user_id = u.id) as net_profit,
                (SELECT COUNT(*) FROM game_results WHERE user_id = u.id AND outcome IN ('win', 'jackpot')) as total_wins
            FROM users u
            LEFT JOIN balances b ON u.id = b.user_id
            ORDER BY net_profit DESC
            LIMIT ?
        `).all(limit);
    }

    static getTopByLevel(limit = 10) {
        return db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.level,
                u.xp,
                b.amount as balance
            FROM users u
            LEFT JOIN balances b ON u.id = b.user_id
            ORDER BY u.level DESC, u.xp DESC
            LIMIT ?
        `).all(limit);
    }

    static getGameLeaderboard(game, limit = 10) {
        return db.prepare(`
            SELECT 
                u.username,
                COUNT(*) as games_played,
                SUM(CASE WHEN gr.outcome IN ('win', 'jackpot') THEN 1 ELSE 0 END) as wins,
                SUM(gr.profit) as net_profit,
                MAX(gr.win_amount) as biggest_win
            FROM game_results gr
            JOIN users u ON gr.user_id = u.id
            WHERE gr.game = ?
            GROUP BY gr.user_id
            ORDER BY net_profit DESC
            LIMIT ?
        `).all(game, limit);
    }

    static getUserRank(userId) {
        const result = db.prepare(`
            SELECT COUNT(*) + 1 as rank
            FROM (
                SELECT user_id, SUM(profit) as net_profit
                FROM game_results
                GROUP BY user_id
                HAVING net_profit > (
                    SELECT SUM(profit)
                    FROM game_results
                    WHERE user_id = ?
                )
            )
        `).get(userId);

        return result.rank;
    }
}

module.exports = LeaderboardService;
