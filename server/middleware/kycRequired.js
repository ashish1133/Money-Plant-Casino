const { db } = require('../config/database');

module.exports = function kycRequired(req, res, next) {
  if (!process.env.REAL_MONEY_MODE || process.env.REAL_MONEY_MODE === 'false') {
    return next();
  }
  const profile = db.prepare('SELECT status FROM kyc_profiles WHERE user_id = ?').get(req.userId);
  if (profile && profile.status === 'verified') {
    return next();
  }
  return res.status(403).json({ error: 'KYC verification required' });
};
