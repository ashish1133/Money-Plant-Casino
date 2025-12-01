const { getFirestore } = require('../config/firebase');
let admin;
try { admin = require('firebase-admin'); } catch (_) {}
const { db } = require('../config/database');

async function ensureLocalUser(uid, email, displayName) {
  // Find or create a local user mapped to Firebase UID
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email || `uid:${uid}@firebase.local`);
  if (existing) return existing.id;
  const username = (displayName || `user_${uid.substring(0,6)}`).replace(/\s+/g,'_');
  const safeEmail = email || `uid:${uid}@firebase.local`;
  const res = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, safeEmail, '');
  const userId = res.lastInsertRowid;
  db.prepare('INSERT INTO balances (user_id, amount) VALUES (?, ?)').run(userId, parseFloat(process.env.INITIAL_BALANCE) || 10000);
  db.prepare('INSERT INTO daily_streaks (user_id, current_streak, last_claim) VALUES (?, 0, 0)').run(userId);
  return userId;
}

async function firebaseAuthenticate(req, res, next) {
  try {
    if (!admin) return res.status(500).json({ error: 'Firebase Admin not installed' });
    // Ensure Firebase Admin SDK is initialized via config/firebase
    try { getFirestore(); } catch(_) {}
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No Firebase ID token provided' });
    }
    const idToken = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(idToken);
    // Fetch user info to map/display
    const userRecord = await admin.auth().getUser(decoded.uid);
    const userId = await ensureLocalUser(decoded.uid, userRecord.email, userRecord.displayName);
    req.userId = userId;
    req.firebaseUid = decoded.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
}

module.exports = firebaseAuthenticate;
