const express = require('express');
const { db } = require('../config/database');
const firebaseAdminOnly = require('../middleware/firebaseAdminOnly');
const router = express.Router();
const kycFields = `user_id, status, full_name, date_of_birth, address_line1, address_line2, city, state, postal_code, country, document_type, document_id, provider, provider_ref, reviewed_at, created_at, updated_at`;

// Protect everything below this line with Firebase admin claim
router.use(firebaseAdminOnly);

// Overview metrics
router.get('/overview', (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
    const totalBalance = db.prepare('SELECT SUM(amount) AS sum FROM balances').get().sum || 0;
    const txCount = db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get().cnt;
    const gamesCount = db.prepare('SELECT COUNT(*) AS cnt FROM game_results').get().cnt;
    const totalProfit = db.prepare('SELECT SUM(profit) AS sum FROM game_results').get().sum || 0;

    res.json({
      users: userCount,
      totalBalance,
      transactions: txCount,
      gamesPlayed: gamesCount,
      aggregateProfit: totalProfit
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Users listing (basic)
router.get('/users', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.level, u.xp, b.amount AS balance, u.created_at
      FROM users u
      LEFT JOIN balances b ON u.id = b.user_id
      ORDER BY u.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recent transactions
router.get('/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transactions = db.prepare(`
      SELECT t.id, t.user_id, u.username, t.type, t.amount, t.balance_after, t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recent game results
router.get('/game-results', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const results = db.prepare(`
      SELECT g.id, g.user_id, u.username, g.game, g.bet_amount, g.win_amount, g.profit, g.outcome, g.created_at
      FROM game_results g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// KYC management
router.get('/kyc/pending', (req, res) => {
  try {
    const rows = db.prepare(`SELECT ${kycFields} FROM kyc_profiles WHERE status = 'pending' ORDER BY created_at DESC`).all();
    res.json({ profiles: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/kyc/:userId', (req, res) => {
  try {
    const row = db.prepare(`SELECT ${kycFields} FROM kyc_profiles WHERE user_id = ?`).get(req.params.userId);
    res.json({ profile: row || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/kyc/:userId/approve', (req, res) => {
  try {
    const now = Date.now();
    const exists = db.prepare('SELECT user_id FROM kyc_profiles WHERE user_id = ?').get(req.params.userId);
    if (exists) {
      db.prepare(`UPDATE kyc_profiles SET status='verified', reviewed_at=?, updated_at=? WHERE user_id=?`).run(now, now, req.params.userId);
    } else {
      db.prepare(`INSERT INTO kyc_profiles (user_id, status, reviewed_at) VALUES (?, 'verified', ?)`).run(req.params.userId, now);
    }
    res.json({ status: 'verified' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/kyc/:userId/reject', (req, res) => {
  try {
    const now = Date.now();
    const reason = (req.body && req.body.reason) || null;
    const exists = db.prepare('SELECT user_id FROM kyc_profiles WHERE user_id = ?').get(req.params.userId);
    if (exists) {
      db.prepare(`UPDATE kyc_profiles SET status='rejected', reviewed_at=?, updated_at=? WHERE user_id=?`).run(now, now, req.params.userId);
    } else {
      db.prepare(`INSERT INTO kyc_profiles (user_id, status, reviewed_at) VALUES (?, 'rejected', ?)`).run(req.params.userId, now);
    }
    res.json({ status: 'rejected', reason });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
