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

// --- Games (simplified provably fair stubs) ---
function rng(seed){
  // Simple deterministic RNG using seed string
  const crypto = require('crypto');
  const h = crypto.createHmac('sha256', 'games-secret').update(String(seed)).digest('hex');
  const n = parseInt(h.slice(0,8),16);
  return n / 0xffffffff;
}

exports.gamesSlots = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { betAmount } = req.body || {};
    const bet = parseInt(betAmount, 10);
    if (!Number.isFinite(bet) || bet < 10) return res.status(400).json({ error: 'Minimum bet is $10' });
    const seed = `${decoded.uid}:${Date.now()}`;
    const r = rng(seed);
    const symbols = ['A','B','C','D','7'];
    const reels = [symbols[Math.floor(r*symbols.length)], symbols[Math.floor(r*symbols.length)], symbols[Math.floor(r*symbols.length)]];
    const win = (reels[0]===reels[1] && reels[1]===reels[2]) ? bet*5 : (reels[0]===reels[1]||reels[1]===reels[2]||reels[0]===reels[2]) ? bet*2 : 0;
    // Balance update + transaction
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      const balanceAfter = (u.balance || 0) - bet + win;
      tx.set(userRef, { uid: decoded.uid, balance: balanceAfter, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('gamePlays').doc(), {
        userId: decoded.uid,
        gameName: 'slots',
        betAmount: bet,
        winAmount: win,
        profit: win - bet,
        outcome: win>0 ? (win>=bet*5?'jackpot':'win') : 'loss',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ reels, winAmount: win, seed, hash: seed, outcome: win>0?'win':'loss' });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});

exports.gamesRoulette = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { betAmount, betColor } = req.body || {};
    const bet = parseInt(betAmount, 10);
    if (!Number.isFinite(bet) || bet < 10) return res.status(400).json({ error: 'Minimum bet is $10' });
    const colors = ['red','black','green'];
    const seed = `${decoded.uid}:${Date.now()}`;
    const r = rng(seed);
    const result = colors[Math.floor(r*colors.length)];
    let winMult = 0;
    if (result==='red' || result==='black') winMult = (betColor===result) ? 2 : 0;
    if (result==='green') winMult = (betColor==='green') ? 14 : 0;
    const win = winMult ? bet*(winMult-1) + bet : 0; // return bet + profit
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      const balanceAfter = (u.balance || 0) - bet + win;
      tx.set(userRef, { uid: decoded.uid, balance: balanceAfter, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('gamePlays').doc(), {
        userId: decoded.uid,
        gameName: 'roulette',
        betAmount: bet,
        winAmount: win,
        profit: win - bet,
        outcome: win>0 ? 'win':'loss',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ result, winAmount: win, seed, hash: seed });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});

exports.gamesDice = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { betAmount, target } = req.body || {};
    const bet = parseInt(betAmount, 10);
    const tgt = parseInt(target, 10);
    if (!Number.isFinite(bet) || bet < 10) return res.status(400).json({ error: 'Minimum bet is $10' });
    if (!Number.isFinite(tgt) || tgt < 2 || tgt > 98) return res.status(400).json({ error: 'Target must be 2–98' });
    const seed = `${decoded.uid}:${Date.now()}`;
    const roll = Math.floor(rng(seed) * 100) + 1; // 1–100
    const win = roll < tgt ? Math.round(bet * (99 / (tgt - 1)) - bet) + bet : 0; // simple multiplier approximation
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      const balanceAfter = (u.balance || 0) - bet + win;
      tx.set(userRef, { uid: decoded.uid, balance: balanceAfter, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('gamePlays').doc(), {
        userId: decoded.uid,
        gameName: 'dice',
        betAmount: bet,
        winAmount: win,
        profit: win - bet,
        outcome: win>0 ? 'win':'loss',
        details: { roll, target: tgt },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ roll, target: tgt, winAmount: win, seed, hash: seed });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});

exports.gamesCrash = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const decoded = await verify(req);
    const { betAmount, autoCashout } = req.body || {};
    const bet = parseInt(betAmount, 10);
    const auto = parseFloat(autoCashout);
    if (!Number.isFinite(bet) || bet < 10) return res.status(400).json({ error: 'Minimum bet is $10' });
    if (!Number.isFinite(auto) || auto < 1.01) return res.status(400).json({ error: 'Auto cashout must be ≥ 1.01x' });
    const seed = `${decoded.uid}:${Date.now()}`;
    const bust = 1 + rng(seed) * 10; // 1–11x range
    const cashedOut = auto <= bust;
    const win = cashedOut ? Math.round(bet * auto) : 0;
    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const u = snap.exists ? snap.data() : { uid: decoded.uid, balance: 10000 };
      const balanceAfter = (u.balance || 0) - bet + win;
      tx.set(userRef, { uid: decoded.uid, balance: balanceAfter, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('gamePlays').doc(), {
        userId: decoded.uid,
        gameName: 'crash',
        betAmount: bet,
        winAmount: win,
        profit: win - bet,
        outcome: cashedOut ? 'win':'loss',
        details: { bust: parseFloat(bust.toFixed(2)), autoCashout: auto },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ bust: parseFloat(bust.toFixed(2)), auto: auto, cashedOut, winAmount: win, seed, hash: seed });
  } catch (e) {
    const code = String(e.message || '').includes('Unauthorized') ? 401 : 500;
    return res.status(code).json({ error: e.message || 'Internal error' });
  }
});
