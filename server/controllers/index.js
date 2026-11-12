const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const tx = require('../services/transactionService');
const audit = require('../services/auditService');
const { parseInstruction } = require('../utils/intentParser');
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const bad = (status, message) => Object.assign(new Error(message), { status });
const token = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '2h' });

// ---- Auth ----
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8) throw bad(422, 'name, valid email and password (8+ chars) required');
  const [ex] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (ex.length) throw bad(409, 'Email already registered');
  const [r] = await pool.query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', [name, email, await bcrypt.hash(password, 12)]);
  await pool.query('INSERT INTO user_spending_limits (user_id) VALUES (?)', [r.insertId]);
  await audit.log(null, r.insertId, 'REGISTER', 'user', r.insertId, {}, req.ip);
  ok(res, { token: token({ id: r.insertId, role: 'user' }), user: { id: r.insertId, name, email, role: 'user' } }, 201);
};
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const [[u]] = await pool.query('SELECT * FROM users WHERE email=?', [email || '']);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) { await audit.log(null, u?.id, 'LOGIN_FAILED', 'user', u?.id, { email }, req.ip); throw bad(401, 'Invalid credentials'); }
  await audit.log(null, u.id, 'LOGIN', 'user', u.id, {}, req.ip);
  ok(res, { token: token(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
};
exports.me = async (req, res) => { const [[u]] = await pool.query('SELECT id,name,email,role,notify_email FROM users WHERE id=?', [req.user.id]); ok(res, u); };
exports.updateProfile = async (req, res) => {
  const { name, notify_email } = req.body;
  await pool.query('UPDATE users SET name=COALESCE(?,name), notify_email=COALESCE(?,notify_email) WHERE id=?', [name ?? null, notify_email ?? null, req.user.id]);
  ok(res, { updated: true });
};

// ---- Payments / transactions ----
exports.requestPayment = async (req, res) => ok(res, await tx.submitPayment(req.user, req.body, req.ip), 201);
exports.listTransactions = async (req, res) => {
  const { status, q, from, to, minAmount, maxAmount, sort = 'created_at', dir = 'desc' } = req.query;
  const cols = { created_at: 't.created_at', amount: 't.amount', risk_score: 't.risk_score', status: 't.status' };
  const where = ['t.user_id=?']; const p = [req.user.id];
  if (status) { where.push('t.status=?'); p.push(status); }
  if (q) { where.push('(m.name LIKE ? OR t.public_id LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  if (from) { where.push('t.created_at>=?'); p.push(from); }
  if (to) { where.push('t.created_at<=?'); p.push(to); }
  if (minAmount) { where.push('t.amount>=?'); p.push(Number(minAmount)); }
  if (maxAmount) { where.push('t.amount<=?'); p.push(Number(maxAmount)); }
  const [rows] = await pool.query(
    `SELECT t.public_id,t.amount,t.currency,t.description,t.status,t.risk_score,t.created_at,m.name merchant,m.id merchant_id
     FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE ${where.join(' AND ')}
     ORDER BY ${cols[sort] || cols.created_at} ${dir === 'asc' ? 'ASC' : 'DESC'} LIMIT 500`, p);
  ok(res, rows);
};
exports.getTransaction = async (req, res) => {
  const [[t]] = await pool.query(`SELECT t.*,m.name merchant,m.trust_score,m.status merchant_status FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE t.public_id=? AND t.user_id=?`, [req.params.id, req.user.id]);
  if (!t) throw bad(404, 'Transaction not found');
  const [analysis] = await pool.query('SELECT * FROM transaction_risk_analysis WHERE transaction_id=? ORDER BY id', [t.id]);
  const [approvals] = await pool.query('SELECT action,outcome,note,created_at FROM payment_approvals WHERE transaction_id=?', [t.id]);
  ok(res, { ...t, analysis, approvals });
};
exports.exportCsv = async (req, res) => {
  const [rows] = await pool.query(`SELECT t.public_id,m.name merchant,t.amount,t.currency,t.status,t.risk_score,t.created_at FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE t.user_id=? ORDER BY t.created_at DESC`, [req.user.id]);
  const esc = (v) => `"${String(v instanceof Date ? v.toISOString() : v).replace(/"/g, '""')}"`;
  res.type('text/csv').attachment('transactions.csv').send(['transaction_id,merchant,amount,currency,status,risk_score,created_at', ...rows.map(r => Object.values(r).map(esc).join(','))].join('\n'));
};
exports.dashboard = async (req, res) => {
  const u = req.user.id;
  const [[s]] = await pool.query(`SELECT COUNT(*) total, SUM(status='APPROVED') approved, SUM(status='BLOCKED') blocked, SUM(status='PENDING_APPROVAL') pending,
    COALESCE(SUM(CASE WHEN status='APPROVED' THEN amount END),0) totalSpending, COALESCE(ROUND(AVG(risk_score)),0) avgRisk FROM transactions WHERE user_id=?`, [u]);
  const [daily] = await pool.query(`SELECT DATE(created_at) day, SUM(status='APPROVED') approved, SUM(status='BLOCKED') blocked, SUM(status='PENDING_APPROVAL') pending
    FROM transactions WHERE user_id=? AND created_at>=NOW() - INTERVAL 14 DAY GROUP BY DATE(created_at) ORDER BY day`, [u]);
  const [recent] = await pool.query(`SELECT t.public_id,t.amount,t.status,t.risk_score,t.created_at,m.name merchant FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE t.user_id=? ORDER BY t.created_at DESC LIMIT 8`, [u]);
  ok(res, { summary: s, daily, recent });
};

// ---- Approvals ----
exports.pendingApprovals = async (req, res) => {
  const [rows] = await pool.query(`SELECT t.public_id,t.amount,t.currency,t.description,t.risk_score,t.created_at,m.name merchant,
    (SELECT reasons FROM transaction_risk_analysis a WHERE a.transaction_id=t.id ORDER BY a.id DESC LIMIT 1) reasons
    FROM transactions t JOIN merchants m ON m.id=t.merchant_id WHERE t.user_id=? AND t.status='PENDING_APPROVAL' ORDER BY t.created_at DESC`, [req.user.id]);
  ok(res, rows);
};
exports.decide = (action) => async (req, res) => ok(res, await tx.decideApproval(req.user, req.params.id, action, req.body?.note, req.ip));

// ---- Limits ----
exports.getLimits = async (req, res) => { await pool.query('INSERT IGNORE INTO user_spending_limits (user_id) VALUES (?)', [req.user.id]); const [[l]] = await pool.query('SELECT * FROM user_spending_limits WHERE user_id=?', [req.user.id]); ok(res, l); };
exports.updateLimits = async (req, res) => {
  const { max_transaction, daily_limit, monthly_limit, allowed_merchants = [], blocked_merchants = [], allowlist_only = false } = req.body;
  const nums = [max_transaction, daily_limit, monthly_limit];
  if (nums.some(n => !(Number(n) > 0))) throw bad(422, 'Limits must be positive numbers');
  if (Number(max_transaction) > Number(daily_limit) || Number(daily_limit) > Number(monthly_limit)) throw bad(422, 'Require max transaction ≤ daily ≤ monthly');
  await pool.query(`UPDATE user_spending_limits SET max_transaction=?,daily_limit=?,monthly_limit=?,allowed_merchants=?,blocked_merchants=?,allowlist_only=? WHERE user_id=?`,
    [max_transaction, daily_limit, monthly_limit, JSON.stringify(allowed_merchants.map(Number)), JSON.stringify(blocked_merchants.map(Number)), allowlist_only ? 1 : 0, req.user.id]);
  await audit.log(null, req.user.id, 'LIMITS_UPDATED', 'limits', req.user.id, req.body, req.ip);
  ok(res, { updated: true });
};

// ---- Merchants ----
exports.listMerchants = async (req, res) => {
  const [rows] = await pool.query(`SELECT m.*, COUNT(t.id) txn_count, COALESCE(SUM(t.status='BLOCKED'),0) blocked_count, COALESCE(SUM(CASE WHEN t.status='APPROVED' THEN t.amount END),0) total_paid
    FROM merchants m LEFT JOIN transactions t ON t.merchant_id=m.id AND t.user_id=? GROUP BY m.id ORDER BY m.name`, [req.user.id]);
  ok(res, rows);
};
exports.setMerchantStatus = async (req, res) => {
  const { status } = req.body;
  if (!['TRUSTED', 'UNVERIFIED', 'BLOCKED'].includes(status)) throw bad(422, 'Invalid status');
  await pool.query('UPDATE merchants SET status=? WHERE id=?', [status, Number(req.params.id)]);
  await audit.log(null, req.user.id, 'MERCHANT_STATUS', 'merchant', req.params.id, { status }, req.ip);
  ok(res, { updated: true });
};

// ---- Agent simulator: parses text, then goes through the SAME security pipeline ----
exports.agentRun = async (req, res) => {
  const [merchants] = await pool.query('SELECT id,name,status,trust_score FROM merchants');
  const parsed = parseInstruction(req.body.instruction, merchants);
  const payload = { merchantId: parsed.merchantId, amount: parsed.amount, currency: parsed.currency, description: parsed.description,
    idempotencyKey: req.body.idempotencyKey || crypto.randomUUID(), timestamp: new Date().toISOString() };
  const result = await tx.submitPayment(req.user, payload, req.ip, req.body.instruction);
  ok(res, { interpretation: parsed, request: payload, result }, 201);
};

// ---- Notifications / audit ----
exports.notifications = async (req, res) => { const [r] = await pool.query('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', [req.user.id]); ok(res, r); };
exports.auditLogs = async (req, res) => { const [r] = await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200'); ok(res, r); };
