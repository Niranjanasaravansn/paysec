import { useState } from 'react';
import { Link } from 'react-router-dom';
import { send, errMsg } from '../api';
import { Badge, Gauge, inr, useToast } from '../ui';

const EXAMPLES = ['Purchase a laptop under ₹50,000 from a trusted merchant.', 'Buy headphones for ₹3,000 from ShadyDeals', 'Pay ₹20,000 to QuickCashOffers', 'Order a smartphone under ₹25,000 from Croma'];

export default function Agent() {
  const toast = useToast();
  const [text, setText] = useState(EXAMPLES[0]); const [busy, setBusy] = useState(false); const [out, setOut] = useState(null);
  const run = async (e) => {
    e.preventDefault(); setBusy(true); setOut(null);
    try { setOut(await send('post', '/agent/run', { instruction: text })); } catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
  };
  const r = out?.result;
  return (<>
    <h1>AI agent simulator</h1><p className="sub">The agent turns your instruction into a payment request. It cannot pay on its own: the security engine decides.</p>
    <form className="card" onSubmit={run}>
      <div className="field"><label htmlFor="ins">Instruction</label><textarea id="ins" rows={3} value={text} onChange={(e) => setText(e.target.value)} required /></div>
      <div className="chips" style={{ marginBottom: 14 }}>{EXAMPLES.map((x) => <button type="button" className="chip" key={x} onClick={() => setText(x)}>{x.length > 40 ? x.slice(0, 40) + '…' : x}</button>)}</div>
      <button className="btn primary" disabled={busy}>{busy ? 'Waiting for security decision…' : 'Send to agent'}</button>
    </form>
    {out && <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card"><h2>Agent's request</h2><dl className="kv"><dt>Merchant</dt><dd>{out.interpretation.merchantName}</dd><dt>Amount</dt><dd>{inr(out.request.amount)}</dd><dt>Item</dt><dd>{out.request.description}</dd><dt>Idempotency key</dt><dd style={{ wordBreak: 'break-all' }}>{out.request.idempotencyKey}</dd></dl>
        {out.interpretation.warnings.map((w) => <p key={w} className="err">{w}</p>)}</div>
      <div className="card" style={{ textAlign: 'center' }}><h2>Security decision</h2><p><Badge v={r.status} /></p>{r.evaluation && <><Gauge score={r.evaluation.score} />
        <ul className="reasons" style={{ textAlign: 'left' }}>{r.evaluation.reasons.length ? r.evaluation.reasons.map((x, i) => <li key={i}>{x}</li>) : <li>No risk signals found</li>}</ul></>}
        {r.payment?.reference && <p className="sub">Payment reference {r.payment.reference} ({r.payment.mode})</p>}
        {r.status === 'PENDING_APPROVAL' && <Link className="btn primary" to="/approvals">Review in approval center</Link>}
        {r.transactionId && <p><Link to={`/risk/${r.transactionId}`}>Full risk analysis</Link></p>}</div></div>}
  </>);
}
