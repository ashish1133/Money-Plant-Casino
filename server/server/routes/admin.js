const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const adminAuthenticate = require('../middleware/adminAuthenticate');
const router = express.Router();

// Admin login (uses ENV ADMIN_USERNAME / ADMIN_PASSWORD and ADMIN_JWT_SECRET)
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!envUser || !envPass || !secret) {
    return res.status(500).json({ error: 'Admin credentials not configured' });
  }
  if (username !== envUser || password !== envPass) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign({ role: 'admin', username: envUser }, secret, { expiresIn: '2h' });
  res.json({ token, expiresIn: '2h' });
});

// Protect everything below this line
router.use(adminAuthenticate);

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
