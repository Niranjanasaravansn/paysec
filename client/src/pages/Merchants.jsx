import { get, send, errMsg } from '../api';
import { useLoad, State, Badge, inr, useToast } from '../ui';

export default function Merchants() {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => get('/merchants'));
  const setStatus = async (id, status) => { try { await send('patch', `/merchants/${id}/status`, { status }); toast('Merchant updated'); reload(); } catch (e) { toast(errMsg(e), 'error'); } };
  return (<>
    <h1>Merchant verification</h1><p className="sub">Trust status feeds directly into every risk score. Blocked merchants are always refused.</p>
    <div className="card"><State loading={loading} error={error} reload={reload} empty={data && !data.length} emptyText="No merchants yet.">
      <div className="scroll"><table><thead><tr><th>Merchant</th><th>ID</th><th>Trust score</th><th>Status</th><th>Your history</th><th>Risk indicators</th><th></th></tr></thead>
        <tbody>{(data || []).map((m) => <tr key={m.id}><td>{m.name}<div className="sub" style={{ margin: 0 }}>{m.category}</div></td><td>{m.merchant_code}</td>
          <td style={{ minWidth: 130 }}>{m.trust_score}<div className="bar"><i style={{ width: `${m.trust_score}%`, background: m.trust_score >= 60 ? 'var(--ok)' : m.trust_score >= 30 ? 'var(--warn)' : 'var(--bad)' }} /></div></td>
          <td><Badge v={m.status} /></td><td>{m.txn_count} payments · {inr(m.total_paid)} paid</td>
          <td>{m.status === 'BLOCKED' ? 'Blocked' : m.trust_score < 60 ? 'Low trust' : m.blocked_count > 0 ? `${m.blocked_count} blocked before` : 'None'}</td>
          <td style={{ display: 'flex', gap: 6 }}>{m.status !== 'TRUSTED' && <button className="btn" onClick={() => setStatus(m.id, 'TRUSTED')}>Trust</button>}
            {m.status !== 'BLOCKED' && <button className="btn danger" onClick={() => setStatus(m.id, 'BLOCKED')}>Block</button>}
            {m.status === 'BLOCKED' && <button className="btn" onClick={() => setStatus(m.id, 'UNVERIFIED')}>Unblock</button>}</td></tr>)}</tbody></table></div>
    </State></div>
  </>);
}
