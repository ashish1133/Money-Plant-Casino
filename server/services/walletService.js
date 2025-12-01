const { db } = require('../config/database');
const logger = require('../config/logger');
const FirestoreService = require('./firestoreService');

class WalletService {
    static getBalance(userId) {
        const result = db.prepare('SELECT amount FROM balances WHERE user_id = ?').get(userId);
        return result ? result.amount : 0;
    }

    static updateBalance(userId, amount, type, metadata = {}) {
        return db.transaction(() => {
            // Get current balance
            const current = this.getBalance(userId);
            const newBalance = current + amount;

            if (newBalance < 0) {
                throw new Error('Insufficient balance');
            }

            // Update balance
            db.prepare('UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ?')
                .run(newBalance, Date.now(), userId);

            // Record transaction
            const stmt = db.prepare(`
                INSERT INTO transactions (user_id, type, amount, balance_after, metadata)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(userId, type, amount, newBalance, JSON.stringify(metadata));

            logger.info(`Balance updated for user ${userId}: ${type} ${amount}, new balance: ${newBalance}`);

            // Mirror to Firestore (best-effort)
            try {
                FirestoreService.recordTransaction({ userId, type, amount, balanceAfter: newBalance });
            } catch (_) {}

            return newBalance;
        })();
    }

    static getTransactions(userId, limit = 50, offset = 0) {
        const stmt = db.prepare(`
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);
        return stmt.all(userId, limit, offset).map(tx => ({
            ...tx,
            metadata: tx.metadata ? JSON.parse(tx.metadata) : {}
        }));
    }

    static deposit(userId, amount) {
        if (amount < 10) {
            throw new Error('Minimum deposit is $10');
        }
        return this.updateBalance(userId, amount, 'deposit');
    }

    static withdraw(userId, amount) {
        if (amount < 10) {
            throw new Error('Minimum withdrawal is $10');
        }
        const balance = this.getBalance(userId);
        if (amount > balance) {
            throw new Error('Insufficient balance');
        }
        return this.updateBalance(userId, -amount, 'withdraw');
    }

    static getDailyLoss(userId) {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const result = db.prepare(`
            SELECT SUM(profit) as total_loss
            FROM game_results
            WHERE user_id = ? AND created_at > ? AND profit < 0
        `).get(userId, oneDayAgo);
        
        return Math.abs(result.total_loss || 0);
    }
}

module.exports = WalletService;
