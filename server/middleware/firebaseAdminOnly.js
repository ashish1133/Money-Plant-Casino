let admin = null;
try { admin = require('firebase-admin'); } catch (_) {}

async function firebaseAdminOnly(req, res, next) {
  try {
    if (!admin) return res.status(500).json({ error: 'Firebase Admin not installed' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No Firebase ID token provided' });
    }
    const idToken = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded || decoded.admin !== true) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    req.firebaseUid = decoded.uid;
    req.firebaseClaims = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
}

module.exports = firebaseAdminOnly;
