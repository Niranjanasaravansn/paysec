/**
 * Rule-based risk engine. NOT machine learning.
 * Pure function: evaluate(input) -> result. To plug in ML later, add a scorer to
 * SCORERS that returns {points, reason}; nothing else needs to change.
 */
const ENGINE_VERSION = 'rules-1.0';
const W = { budget: 30, merchant: 30, amount: 15, frequency: 15, pattern: 10 };
const levelOf = (s) => (s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 30 ? 'MEDIUM' : 'LOW');

function mandatoryChecks({ amount, limits, merchant, history }) {
  const v = [];
  const blocked = (limits.blocked_merchants || []).map(Number);
  const allowed = (limits.allowed_merchants || []).map(Number);
  if (merchant.status === 'BLOCKED' || blocked.includes(merchant.id)) v.push('Merchant is blocked');
  if (limits.allowlist_only && !allowed.includes(merchant.id)) v.push('Merchant is not on your allowed list');
  if (amount > limits.max_transaction) v.push(`Amount exceeds max transaction limit (${limits.max_transaction})`);
  if (history.dailySpent + amount > limits.daily_limit) v.push(`Exceeds daily limit (${limits.daily_limit})`);
  if (history.monthlySpent + amount > limits.monthly_limit) v.push(`Exceeds monthly limit (${limits.monthly_limit})`);
  return v;
}

const SCORERS = {
  budget({ amount, limits, history }) {
    const hit = amount > limits.max_transaction || history.dailySpent + amount > limits.daily_limit ||
      history.monthlySpent + amount > limits.monthly_limit;
    return hit ? { points: W.budget, reason: 'Budget violation' } : { points: 0 };
  },
  merchant({ merchant, limits }) {
    const allowed = (limits.allowed_merchants || []).map(Number).includes(merchant.id);
    if (merchant.status === 'TRUSTED' && merchant.trust_score >= 60) return { points: 0 };
    if (allowed && merchant.status !== 'BLOCKED') return { points: 0 };
    return { points: W.merchant, reason: `Untrusted merchant (${merchant.status}, trust ${merchant.trust_score})` };
  },
  amount({ amount, history }) {
    if (history.count < 3) return { points: 0 };
    const limit = Math.max(history.avg + 3 * history.sd, history.avg * 3);
    return amount > limit ? { points: W.amount, reason: `Amount unusual vs. average ${Math.round(history.avg)}` } : { points: 0 };
  },
  frequency({ history }) {
    return history.recentCount >= 4
      ? { points: W.frequency, reason: `${history.recentCount} requests in the last 10 minutes` } : { points: 0 };
  },
  pattern({ amount, history, now }) {
    const night = now.getHours() < 5;
    const newMerchantBig = history.merchantTxnCount === 0 && history.count >= 3 && amount > history.avg * 2;
    if (night || newMerchantBig)
      return { points: W.pattern, reason: night ? 'Transaction at unusual hour (00:00–05:00)' : 'Large first-time purchase at new merchant' };
    return { points: 0 };
  },
};

function evaluate(input) {
  const ctx = { ...input, now: input.now || new Date() };
  const factors = {}; const reasons = []; let score = 0;
  for (const [k, fn] of Object.entries(SCORERS)) {
    const r = fn(ctx); factors[k] = r.points; score += r.points;
    if (r.reason) reasons.push(r.reason);
  }
  score = Math.max(0, Math.min(100, score));
  const mandatory = mandatoryChecks(ctx);
  const riskLevel = levelOf(score);

  let decision;
  if (mandatory.length) decision = 'BLOCKED';            // hard rules override the score
  else if (riskLevel === 'CRITICAL') decision = 'BLOCKED';
  else if (riskLevel === 'LOW') decision = 'APPROVED';
  else decision = 'PENDING_APPROVAL';                     // MEDIUM / HIGH need the user

  const recommendedAction = { APPROVED: 'Execute payment', BLOCKED: 'Do not execute', PENDING_APPROVAL: 'Ask the user to confirm' }[decision];
  return { score, riskLevel, decision, factors, reasons: [...mandatory, ...reasons], mandatoryViolations: mandatory, recommendedAction, engineVersion: ENGINE_VERSION };
}
module.exports = { evaluate, levelOf, ENGINE_VERSION };
