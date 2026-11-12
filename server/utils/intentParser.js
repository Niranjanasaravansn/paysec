/** Rule-based natural-language parser for the agent simulator. Not an LLM. */
const CATALOG = { laptop: 48000, smartphone: 25000, phone: 25000, headphones: 3000, keyboard: 2500, monitor: 12000, book: 500, tablet: 20000 };

function parseAmount(t) {
  const m = t.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|lakh)?/i) || t.match(/(?:under|below|up to|max(?:imum)?(?: of)?)\s*([\d,]+(?:\.\d+)?)\s*(k|lakh)?/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (m[2] && m[2].toLowerCase() === 'k') n *= 1000;
  if (m[2] && m[2].toLowerCase() === 'lakh') n *= 100000;
  return n;
}

function parseInstruction(text, merchants) {
  const t = String(text || '').toLowerCase();
  const ceiling = parseAmount(t);
  if (ceiling == null) throw Object.assign(new Error('Could not find a budget/amount in the instruction'), { status: 422 });
  const item = Object.keys(CATALOG).find(k => t.includes(k)) || null;
  const isCeiling = /under|below|up to|max/.test(t);
  const amount = isCeiling && item ? Math.min(ceiling, CATALOG[item]) : ceiling;
  const trustedOnly = /trusted|verified/.test(t);
  let merchant = merchants.find(m => t.includes(m.name.toLowerCase()));
  if (!merchant && trustedOnly) merchant = merchants.filter(m => m.status === 'TRUSTED').sort((a, b) => b.trust_score - a.trust_score)[0];
  if (!merchant) throw Object.assign(new Error('Could not determine a merchant. Name one or ask for a trusted merchant.'), { status: 422 });
  const warnings = trustedOnly && merchant.status !== 'TRUSTED' ? [`${merchant.name} is not TRUSTED; the security engine will decide.`] : [];
  return { amount, currency: 'INR', description: item ? `Purchase: ${item}` : 'Purchase', merchantId: merchant.id, merchantName: merchant.name, budgetCeiling: ceiling, warnings };
}
module.exports = { parseInstruction };
