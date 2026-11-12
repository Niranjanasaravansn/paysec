import { useNavigate, useParams } from 'react-router-dom';
import { get } from '../api';
import { useLoad, State, Gauge, Badge, inr, when, parse, label, levelOf } from '../ui';

const WEIGHTS = { budget: ['Budget violation', 30], merchant: ['Merchant trust', 30], amount: ['Unusual amount', 15], frequency: ['Transaction frequency', 15], pattern: ['Unusual pattern', 10] };
const ACTION = { APPROVED: 'Execute payment', BLOCKED: 'Do not execute', PENDING_APPROVAL: 'Ask the user to confirm' };

export default function RiskAnalysis() {
  const { id } = useParams(); const nav = useNavigate();
  const list = useLoad(() => get('/transactions'));
  const one = useLoad(() => (id ? get(`/transactions/${id}`) : Promise.resolve(null)), [id]);
  const t = one.data; const a = t?.analysis?.[t.analysis.length - 1];
  return (<>
    <h1>AI risk analysis</h1><p className="sub">How the rule-based engine scored a payment, and why.</p>
    <div className="card field"><label htmlFor="pick">Transaction</label>
      <select id="pick" value={id || ''} onChange={(e) => nav(e.target.value ? `/risk/${e.target.value}` : '/risk')}>
        <option value="">Select a transaction…</option>{(list.data || []).map((x) => <option key={x.public_id} value={x.public_id}>{x.merchant} · {inr(x.amount)} · {x.public_id.slice(0, 8)}</option>)}</select></div>
    {!id ? <div className="empty">Pick a transaction to see its score breakdown.</div> : <State loading={one.loading} error={one.error} reload={one.reload}>{t && a && <div className="grid g2">
      <div className="card" style={{ textAlign: 'center' }}><Gauge score={a.risk_score} size={260} />
        <p><Badge v={a.risk_level} /> <Badge v={t.status} /></p><p><b>Recommended action:</b> {ACTION[a.decision]}</p>
        <p className="sub">{t.merchant} · {inr(t.amount)} · {when(t.created_at)}</p></div>
      <div className="card"><h2>Why this score</h2>
        {Object.entries(parse(a.factors)).map(([k, v]) => <div key={k} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{WEIGHTS[k][0]}</span><b>{v} / {WEIGHTS[k][1]}</b></div><div className="bar"><i style={{ width: `${(v / WEIGHTS[k][1]) * 100}%`, background: v ? 'var(--warn)' : 'var(--ok)' }} /></div></div>)}
        <h2 style={{ marginTop: 18 }}>Reasons</h2>{parse(a.reasons).length ? <ul className="reasons">{parse(a.reasons).map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="sub">No risk signals found.</p>}
        {parse(a.mandatory_violations).length > 0 && <p className="err"><b>Hard rule violated.</b> This overrides the score and blocks the payment.</p>}
        {t.analysis.length > 1 && <p className="sub">Re-checked {t.analysis.length - 1}× on approval. Showing the latest ({label(a.stage)}).</p>}
      </div></div>}</State>}
  </>);
}
