import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { get, send, errMsg } from '../api';
import { useLoad, State, Risk, inr, when, parse, useToast } from '../ui';

export default function Approvals() {
  const toast = useToast(); const { setPending } = useOutletContext();
  const [busy, setBusy] = useState(null);
  const { data, loading, error, reload } = useLoad(async () => { const r = await get('/approvals/pending'); setPending(r.length); return r; });
  const decide = async (id, action) => {
    setBusy(id);
    try {
      const r = await send('post', `/approvals/${id}/${action}`, {});
      toast(r.status === 'APPROVED' ? 'Approved and paid' : r.status === 'REJECTED' ? 'Rejected' : `Not paid: ${r.status.toLowerCase()}${r.reasons ? ' – ' + r.reasons[0] : ''}`, r.status === 'APPROVED' || r.status === 'REJECTED' ? 'ok' : 'error');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(null); }
  };
  return (<>
    <h1>Approval center</h1><p className="sub">Payments the engine won't send without your say-so. Approving re-checks your limits first.</p>
    <State loading={loading} error={error} reload={reload} empty={data && !data.length} emptyText="Nothing waiting. Risky payments will show up here.">
      <div className="grid">{(data || []).map((t) => <div className="card" key={t.public_id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><h2>{t.merchant} · {inr(t.amount)}</h2><Risk score={t.risk_score} /></div>
        <p className="sub">{t.description} · requested {when(t.created_at)}</p>
        <ul className="reasons">{parse(t.reasons).map((r, i) => <li key={i}>{r}</li>)}</ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy === t.public_id} onClick={() => decide(t.public_id, 'approve')}>Approve payment</button>
          <button className="btn danger" disabled={busy === t.public_id} onClick={() => decide(t.public_id, 'reject')}>Reject</button>
          <Link className="btn" to={`/risk/${t.public_id}`}>View risk analysis</Link></div></div>)}</div>
    </State>
  </>);
}
