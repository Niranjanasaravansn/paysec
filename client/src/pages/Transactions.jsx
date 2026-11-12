import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { get, errMsg } from '../api';
import { useLoad, State, Badge, Risk, Modal, inr, when, parse, useToast } from '../ui';

function Detail({ id, onClose }) {
  const { data: t, loading, error, reload } = useLoad(() => get(`/transactions/${id}`), [id]);
  return <Modal onClose={onClose}><State loading={loading} error={error} reload={reload}>{t && <>
    <h2>{t.merchant} · {inr(t.amount)}</h2>
    <dl className="kv"><dt>Transaction ID</dt><dd>{t.public_id}</dd><dt>Status</dt><dd><Badge v={t.status} /></dd><dt>Risk</dt><dd><Risk score={t.risk_score} /></dd>
      <dt>Merchant</dt><dd><Badge v={t.merchant_status} /> trust {t.trust_score}</dd><dt>Created</dt><dd>{when(t.created_at)}</dd>
      <dt>Payment ref</dt><dd>{t.payment_reference || '—'}</dd>
      {t.approvals.map((a, i) => <div key={i} style={{ display: 'contents' }}><dt>User decision</dt><dd>{a.action.toLowerCase()} → {a.outcome.toLowerCase()} ({when(a.created_at)})</dd></div>)}</dl>
    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}><Link className="btn primary" to={`/risk/${t.public_id}`}>Full risk analysis</Link><button className="btn" onClick={onClose}>Close</button></div></>}</State></Modal>;
}

export default function Transactions({ mode }) {
  const toast = useToast();
  const [f, setF] = useState({ q: '', status: '', from: '', to: '', minAmount: '', maxAmount: '', sort: 'created_at', dir: 'desc' });
  const [sel, setSel] = useState(null);
  const { data, loading, error, reload } = useLoad(() => get('/transactions', Object.fromEntries(Object.entries(f).filter(([, v]) => v))), [JSON.stringify(f)]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sort = (k) => setF({ ...f, sort: k, dir: f.sort === k && f.dir === 'desc' ? 'asc' : 'desc' });
  const arrow = (k) => (f.sort === k ? (f.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const csv = async () => {
    try { const r = await api.get('/transactions/export.csv', { responseType: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'transactions.csv'; a.click(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  const history = mode === 'history';
  return (<>
    <h1>{history ? 'Transaction history' : 'Transaction monitoring'}</h1><p className="sub">{history ? 'Filter by date, status and amount, then download a report.' : 'Every payment request and the decision made on it.'}</p>
    <div className="card" style={{ marginBottom: 16 }}><div className="row">
      <div><label htmlFor="q">Search</label><input id="q" placeholder="Merchant or transaction ID" value={f.q} onChange={set('q')} /></div>
      <div><label htmlFor="s">Status</label><select id="s" value={f.status} onChange={set('status')}><option value="">All</option>{['APPROVED', 'BLOCKED', 'PENDING_APPROVAL', 'REJECTED', 'FAILED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
      {history && <><div><label htmlFor="fr">From</label><input id="fr" type="date" value={f.from} onChange={set('from')} /></div><div><label htmlFor="to">To</label><input id="to" type="date" value={f.to} onChange={set('to')} /></div>
        <div><label htmlFor="mn">Min ₹</label><input id="mn" type="number" value={f.minAmount} onChange={set('minAmount')} /></div><div><label htmlFor="mx">Max ₹</label><input id="mx" type="number" value={f.maxAmount} onChange={set('maxAmount')} /></div>
        <button className="btn primary" onClick={csv}>Download CSV</button></>}
    </div></div>
    <div className="card"><State loading={loading} error={error} reload={reload} empty={data && !data.length} emptyText="No transactions match these filters.">
      {data && <div className="scroll"><table><thead><tr><th>ID</th><th>Merchant</th><th className="sort" onClick={() => sort('amount')}>Amount{arrow('amount')}</th><th className="sort" onClick={() => sort('created_at')}>Date{arrow('created_at')}</th><th className="sort" onClick={() => sort('risk_score')}>Risk{arrow('risk_score')}</th><th className="sort" onClick={() => sort('status')}>Status{arrow('status')}</th></tr></thead>
        <tbody>{data.map((t) => <tr key={t.public_id} className="click" tabIndex={0} onClick={() => setSel(t.public_id)} onKeyDown={(e) => e.key === 'Enter' && setSel(t.public_id)}>
          <td>{t.public_id.slice(0, 8)}</td><td>{t.merchant}</td><td>{inr(t.amount)}</td><td>{when(t.created_at)}</td><td><Risk score={t.risk_score} /></td><td><Badge v={t.status} /></td></tr>)}</tbody></table></div>}
    </State></div>
    {sel && <Detail id={sel} onClose={() => setSel(null)} />}
  </>);
}
