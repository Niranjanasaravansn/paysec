const crypto = require('crypto');
/** Simulated gateway by default. With PayPal SANDBOX creds it creates a sandbox order (no capture, no real money). */
async function execute({ amount, currency, publicId }) {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return { reference: 'SIM-' + crypto.randomBytes(6).toString('hex').toUpperCase(), mode: 'simulated' };
  const base = 'https://api-m.sandbox.paypal.com';
  const tok = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', body: 'grant_type=client_credentials',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!tok.ok) throw new Error('PayPal sandbox auth failed');
  const { access_token } = await tok.json();
  const res = await fetch(`${base}/v2/checkout/orders`, { method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': publicId },
    body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: publicId, amount: { currency_code: currency === 'INR' ? 'USD' : currency, value: amount.toFixed(2) } }] }) });
  if (!res.ok) throw new Error('PayPal sandbox order failed');
  return { reference: 'PP-SBX-' + (await res.json()).id, mode: 'paypal-sandbox' };
}
module.exports = { execute };
