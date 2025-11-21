const jwt = require('jsonwebtoken');

function adminAuthenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin token required' });
  }
  const token = auth.slice(7);
  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Admin secret not configured' });
    const decoded = jwt.verify(token, secret);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Invalid role' });
    req.admin = { username: decoded.username };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

module.exports = adminAuthenticate;