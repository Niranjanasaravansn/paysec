const test = require('node:test');
const assert = require('node:assert');
const { evaluate } = require('../services/riskEngine');
const { parseInstruction } = require('../utils/intentParser');

const limits = { max_transaction: 50000, daily_limit: 80000, monthly_limit: 200000, allowed_merchants: [], blocked_merchants: [], allowlist_only: 0 };
const trusted = { id: 1, name: 'Amazon India', status: 'TRUSTED', trust_score: 96 };
const shady = { id: 4, name: 'ShadyDeals', status: 'UNVERIFIED', trust_score: 35 };
const blocked = { id: 5, name: 'QuickCashOffers', status: 'BLOCKED', trust_score: 8 };
const hist = { dailySpent: 0, monthlySpent: 0, count: 5, avg: 10000, sd: 2000, recentCount: 0, merchantTxnCount: 2 };
const noon = new Date('2026-01-10T12:00:00');
const ev = (o) => evaluate({ amount: 10000, limits, merchant: trusted, history: hist, now: noon, ...o });

test('1 within budget + trusted merchant -> APPROVED', () => { const r = ev(); assert.equal(r.decision, 'APPROVED'); assert.equal(r.riskLevel, 'LOW'); });
test('2 exceeds hard max limit -> BLOCKED even with trusted merchant', () => assert.equal(ev({ amount: 60000 }).decision, 'BLOCKED'));
test('3 blocked merchant -> BLOCKED', () => assert.equal(ev({ merchant: blocked }).decision, 'BLOCKED'));
test('4 untrusted merchant within budget -> PENDING_APPROVAL', () => assert.equal(ev({ merchant: shady }).decision, 'PENDING_APPROVAL'));
test('4b unusual amount + frequency + untrusted -> high risk, pending', () => {
  const r = ev({ merchant: shady, amount: 45000, history: { ...hist, recentCount: 5 } });
  assert.ok(r.score >= 60); assert.equal(r.decision, 'PENDING_APPROVAL');
});
test('10 exceeds daily limit -> BLOCKED', () => assert.equal(ev({ amount: 30000, history: { ...hist, dailySpent: 60000 } }).decision, 'BLOCKED'));
test('mandatory violation overrides low score', () => {
  const r = ev({ amount: 30000, limits: { ...limits, allowlist_only: 1, allowed_merchants: [2] } });
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.mandatoryViolations.length > 0);
});
test('score is clamped to 0-100', () => { const r = ev({ merchant: blocked, amount: 90000, now: new Date('2026-01-10T02:00:00'), history: { ...hist, recentCount: 9, dailySpent: 99999 } }); assert.ok(r.score <= 100); });
test('agent parser: laptop under 50k from trusted merchant', () => {
  const p = parseInstruction('Purchase a laptop under ₹50,000 from a trusted merchant.', [trusted, shady]);
  assert.equal(p.merchantId, 1); assert.equal(p.amount, 48000);
});
test('agent parser rejects missing amount', () => assert.throws(() => parseInstruction('buy a laptop', [trusted])));
