const { getFirestore, isFirebaseEnabled } = require('../config/firebase');
let admin = null;
try { admin = require('firebase-admin'); } catch (_) {}

class FirestoreService {
  static async syncUserProfile({ userId, username, email, level, xp, balance, createdAt }) {
    try {
      const db = getFirestore();
      if (!db) return;
      const doc = db.collection('users').doc(String(userId));
      await doc.set({
        userId,
        username,
        email,
        level,
        xp,
        balance,
        createdAt,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore syncUserProfile failed:', e.message);
    }
  }

  static async recordUserLogin({ userId, username }) {
    try {
      const db = getFirestore();
      if (!db) return;
      await db.collection('user_login_events').add({
        userId,
        username,
        timestamp: Date.now()
      });
      // Update lastLogin on profile
      const doc = db.collection('users').doc(String(userId));
      await doc.set({ lastLogin: Date.now() }, { merge: true });
    } catch (e) {
      console.warn('Firestore recordUserLogin failed:', e.message);
    }
  }

  static async syncAdminAccount({ username }) {
    try {
      const db = getFirestore();
      if (!db) return;
      const doc = db.collection('admins').doc(String(username));
      await doc.set({
        username,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore syncAdminAccount failed:', e.message);
    }
  }

  static async recordAdminLogin({ username }) {
    try {
      const db = getFirestore();
      if (!db) return;
      await db.collection('admin_login_events').add({
        username,
        timestamp: Date.now()
      });
      await db.collection('admins').doc(String(username)).set({ lastLogin: Date.now() }, { merge: true });
    } catch (e) {
      console.warn('Firestore recordAdminLogin failed:', e.message);
    }
  }

  static async recordTransaction({ userId, type, amount, balanceAfter }) {
    try {
      const db = getFirestore();
      if (!db) return;
      const data = {
        userId: String(userId),
        type,
        amount,
        balanceAfter,
        createdAt: admin ? admin.firestore.FieldValue.serverTimestamp() : Date.now()
      };
      await db.collection('transactions').add(data);
      // Mirror basic fields on users doc
      const inc = admin && admin.firestore ? admin.firestore.FieldValue.increment : (n)=>n;
      const updates = { balance: balanceAfter };
      if (type === 'deposit') updates.totalDeposited = inc(amount);
      await db.collection('users').doc(String(userId)).set(updates, { merge: true });
    } catch (e) {
      console.warn('Firestore recordTransaction failed:', e.message);
    }
  }

  static async recordGamePlay({ userId, gameName, betAmount, winAmount, profit, outcome, details }) {
    try {
      const db = getFirestore();
      if (!db) return;
      const data = {
        userId: String(userId),
        gameName,
        betAmount,
        winAmount,
        profit,
        outcome,
        details: details || null,
        createdAt: admin ? admin.firestore.FieldValue.serverTimestamp() : Date.now()
      };
      await db.collection('gamePlays').add(data);
      // Update user aggregates
      const inc = admin && admin.firestore ? admin.firestore.FieldValue.increment : (n)=>n;
      const updates = {};
      if (outcome === 'win' || outcome === 'jackpot') {
        updates.totalWon = inc(winAmount || 0);
      } else if (outcome !== 'push') {
        updates.totalLost = inc(betAmount || 0);
      }
      await db.collection('users').doc(String(userId)).set(updates, { merge: true });
    } catch (e) {
      console.warn('Firestore recordGamePlay failed:', e.message);
    }
  }
}

module.exports = FirestoreService;
