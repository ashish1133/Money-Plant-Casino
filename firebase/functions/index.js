const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();
const db = admin.firestore();

async function verify(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw new Error('Unauthorized');
  const idToken = auth.substring(7);
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
}

exports.usersProfile = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const snap = await db.collection('users').doc(decoded.uid).get();
    const userDoc = snap.exists ? snap.data() : { uid: decoded.uid };
    return res.json({ user: userDoc });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});

exports.walletDeposit = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { amount } = req.body || {};
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt < 10) return res.status(400).json({ error: 'Minimum deposit is $10' });
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      const balanceAfter = (u.balance || 0) + amt;
      tx.set(userRef, {
        uid: decoded.uid,
        balance: balanceAfter,
        totalDeposited: admin.firestore.FieldValue.increment(amt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(db.collection('transactions').doc(), {
        userId: decoded.uid,
        type: 'deposit',
        amount: amt,
        balanceAfter,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ ok: true });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});

exports.walletWithdraw = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { amount } = req.body || {};
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt < 10) return res.status(400).json({ error: 'Minimum withdrawal is $10' });
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      if ((u.balance || 0) < amt) throw new Error('Insufficient funds');
      const balanceAfter = (u.balance || 0) - amt;
      tx.set(userRef, {
        uid: decoded.uid,
        balance: balanceAfter,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(db.collection('transactions').doc(), {
        userId: decoded.uid,
        type: 'withdraw',
        amount: -amt,
        balanceAfter,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ ok: true });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});
