const jwt = require('jsonwebtoken');
exports.authenticate = (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Authentication required' });
  try { const p = jwt.verify(h.slice(7), process.env.JWT_SECRET); req.user = { id: p.id, role: p.role }; next(); }
  catch { res.status(401).json({ success: false, error: 'Invalid or expired token' }); }
};
exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ success: false, error: 'Forbidden' });
