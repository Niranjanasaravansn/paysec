const crypto = require('crypto');
const pool = require('../config/db');
const risk = require('./riskEngine');
const gateway = require('./paymentGateway');
const audit = require('./auditService');

const err = (status, message) => Object.assign(new Error(message), { status });
const json = (v) => (v == null ? [] : typeof v === 'string' ? JSON.parse(v) : v);

async function getContext(conn, userId, merchantId, excludeTxnId = 0) {
  const [[merchant]] = await conn.query('SELECT * FROM merchants WHERE id=?', [merchantId]);
  if (!merchant) throw err(404, 'Merchant not found');
  await conn.query('INSERT IGNORE INTO user_spending_limits (user_id) VALUES (?)', [userId]);
  const [[l]] = await conn.query('SELECT * FROM user_spending_limits WHERE user_id=?', [userId]);
  const limits = { ...l, allowed_merchants: json(l.allowed_merchants), blocked_merchants: json(l.blocked_merchants) };
  const [[h]] = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN created_at>=CURDATE() THEN amount END),0) dailySpent,
            COALESCE(SUM(CASE WHEN created_at>=DATE_FORMAT(NOW(),'%Y-%m-01') THEN amount END),0) monthlySpent,
            COUNT(*) count, COALESCE(AVG(amount),0) avg, COALESCE(STDDEV_POP(amount),0) sd,
            COALESCE(SUM(merchant_id=?),0) merchantTxnCount
     FROM transactions WHERE user_id=? AND status='APPROVED' AND id<>?`, [merchantId, userId, excludeTxnId]);
  const [[r]] = await conn.query(
    `SELECT COUNT(*) c FROM transactions WHERE user_id=? AND created_at>=NOW() - INTERVAL 10 MINUTE AND id<>?`, [userId, excludeTxnId]);
  return { merchant, limits, history: { ...h, recentCount: r.c } };
}

async function saveAnalysis(conn, txnId, stage, e) {
  await conn.query(
    `INSERT INTO transaction_risk_analysis (transaction_id,stage,risk_score,risk_level,decision,factors,reasons,mandatory_violations,engine_version)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [txnId, stage, e.score, e.riskLevel, e.decision, JSON.stringify(e.factors), JSON.stringify(e.reasons), JSON.stringify(e.mandatoryViolations), e.engineVersion]);
}

async function executePayment(conn, txn) {
  try {
    const g = await gateway.execute({ amount: txn.amount, currency: txn.currency, publicId: txn.public_id });
    const [r] = await conn.query(`UPDATE transactions SET status='APPROVED', payment_reference=?, executed_at=NOW() WHERE id=? AND executed_at IS NULL`, [g.reference, txn.id]);
    if (!r.affectedRows) throw new Error('Already executed');       // duplicate-execution guard
    return { status: 'APPROVED', reference: g.reference, mode: g.mode };
  } catch (e) {
    await conn.query(`UPDATE transactions SET status='FAILED' WHERE id=? AND executed_at IS NULL`, [txn.id]);
    return { status: 'FAILED', error: e.message };
  }
}

/** Every payment (agent or API) enters here. Nothing executes before risk.evaluate(). */
async function submitPayment(user, body, ip, instruction = null) {
  const { merchantId, amount, currency = 'INR', description = '', idempotencyKey, timestamp } = body;
  if (!Number.isInteger(merchantId) || !(amount > 0) || amount > 1e8) throw err(422, 'merchantId (int) and positive amount required');
  if (!idempotencyKey || String(idempotencyKey).length > 80) throw err(422, 'idempotencyKey required (max 80 chars)');
  const ts = new Date(timestamp || Date.now());
  const maxAge = Number(process.env.REQUEST_MAX_AGE_SECONDS || 300) * 1000;
  if (isNaN(ts) || Math.abs(Date.now() - ts) > maxAge) throw err(400, 'Stale or invalid request timestamp (replay protection)');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE', [user.id]); // serialises concurrent requests per user
    const [dup] = await conn.query(
      `SELECT t.public_id, t.status, t.risk_score FROM agent_payment_requests r JOIN transactions t ON t.request_id=r.id
       WHERE r.user_id=? AND r.idempotency_key=?`, [user.id, idempotencyKey]);
    if (dup.length) { await conn.commit(); return { duplicate: true, transactionId: dup[0].public_id, status: dup[0].status }; }

    const ctx = await getContext(conn, user.id, merchantId);
    const evalResult = risk.evaluate({ amount, ...ctx });
    const [rq] = await conn.query(`INSERT INTO agent_payment_requests (user_id,idempotency_key,instruction,payload,requested_at) VALUES (?,?,?,?,?)`,
      [user.id, idempotencyKey, instruction, JSON.stringify(body), ts]);
    const publicId = crypto.randomUUID();
    const [tx] = await conn.query(
      `INSERT INTO transactions (public_id,user_id,merchant_id,request_id,amount,currency,description,status,risk_score) VALUES (?,?,?,?,?,?,?,?,?)`,
      [publicId, user.id, merchantId, rq.insertId, amount, currency, description, evalResult.decision, evalResult.score]);
    await saveAnalysis(conn, tx.insertId, 'INITIAL', evalResult);

    let outcome = { status: evalResult.decision };
    if (evalResult.decision === 'APPROVED') outcome = await executePayment(conn, { id: tx.insertId, public_id: publicId, amount, currency });
    if (evalResult.decision === 'PENDING_APPROVAL')
      await conn.query('INSERT INTO notifications (user_id,message) VALUES (?,?)', [user.id, `Approval needed: ${amount} ${currency} at ${ctx.merchant.name}`]);
    await audit.log(conn, user.id, 'PAYMENT_EVALUATED', 'transaction', tx.insertId, { decision: outcome.status, score: evalResult.score }, ip);
    await conn.commit();
    return { duplicate: false, transactionId: publicId, status: outcome.status, evaluation: evalResult, payment: outcome };
  } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
}

async function decideApproval(user, publicId, action, note, ip) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[txn]] = await conn.query('SELECT * FROM transactions WHERE public_id=? FOR UPDATE', [publicId]);
    if (!txn) throw err(404, 'Transaction not found');
    if (txn.user_id !== user.id) {
      await audit.log(conn, user.id, 'UNAUTHORIZED_APPROVAL_ATTEMPT', 'transaction', txn.id, {}, ip);
      await conn.commit();
      throw err(403, 'Only the owner can decide this transaction');
    }
    if (txn.status !== 'PENDING_APPROVAL') throw err(409, `Transaction is already ${txn.status}`);

    let result;
    if (action === 'REJECT') {
      await conn.query(`UPDATE transactions SET status='REJECTED' WHERE id=?`, [txn.id]);
      result = { status: 'REJECTED' };
    } else {
      const ctx = await getContext(conn, user.id, txn.merchant_id, txn.id);   // revalidate against current state
      const e = risk.evaluate({ amount: txn.amount, ...ctx });
      await saveAnalysis(conn, txn.id, 'REVALIDATION', e);
      if (e.mandatoryViolations.length || e.riskLevel === 'CRITICAL') {
        await conn.query(`UPDATE transactions SET status='BLOCKED', risk_score=? WHERE id=?`, [e.score, txn.id]);
        result = { status: 'BLOCKED', reasons: e.reasons };
      } else result = await executePayment(conn, txn);
    }
    await conn.query(`INSERT INTO payment_approvals (transaction_id,user_id,action,outcome,note) VALUES (?,?,?,?,?)`, [txn.id, user.id, action, result.status, note || null]);
    await audit.log(conn, user.id, `APPROVAL_${action}`, 'transaction', txn.id, { outcome: result.status }, ip);
    await conn.commit();
    return result;
  } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
}
module.exports = { submitPayment, decideApproval };
