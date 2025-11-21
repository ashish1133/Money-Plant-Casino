const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const logger = require('../config/logger');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

class AuthService {
    static async register(username, email, password) {
        try {
            // Hash password
            const password_hash = await bcrypt.hash(password, 10);
            
            // Insert user
            const stmt = db.prepare(`
                INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)
            `);
            const result = stmt.run(username, email, password_hash);
            const userId = result.lastInsertRowid;

            // Create initial balance
            db.prepare('INSERT INTO balances (user_id, amount) VALUES (?, ?)').run(userId, parseFloat(process.env.INITIAL_BALANCE) || 10000);

            // Create streak record
            db.prepare('INSERT INTO daily_streaks (user_id, current_streak, last_claim) VALUES (?, 0, 0)').run(userId);

            logger.info(`User registered: ${username} (ID: ${userId})`);
            
            return { userId, username, email };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error('Username or email already exists');
            }
            throw error;
        }
    }

    static async login(username, password) {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (user.self_excluded) {
            throw new Error('Account is self-excluded');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), user.id);

        // Generate tokens
        const accessToken = jwt.sign({ userId: user.id }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
        const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

        // Store refresh token
        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
        db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, refreshToken, expiresAt);

        logger.info(`User logged in: ${username} (ID: ${user.id})`);

        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                level: user.level,
                xp: user.xp
            },
            accessToken,
            refreshToken
        };
    }

    static async refresh(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
            
            // Check if token exists in DB
            const tokenRecord = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?').get(refreshToken, decoded.userId);
            
            if (!tokenRecord || tokenRecord.expires_at < Date.now()) {
                throw new Error('Invalid or expired refresh token');
            }

            // Generate new access token
            const accessToken = jwt.sign({ userId: decoded.userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

            return { accessToken };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    static async logout(refreshToken) {
        db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
        logger.info('User logged out');
    }

    static verifyAccessToken(token) {
        try {
            return jwt.verify(token, ACCESS_SECRET);
        } catch (error) {
            throw new Error('Invalid access token');
        }
    }
}

module.exports = AuthService;
