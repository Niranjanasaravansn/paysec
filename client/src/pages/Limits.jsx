import { useEffect, useState } from 'react';
import { get, send, errMsg } from '../api';
import { useLoad, State, parse, useToast } from '../ui';

export default function Limits() {
  const toast = useToast();
  const lim = useLoad(() => get('/limits')); const mer = useLoad(() => get('/merchants'));
  const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (lim.data) setF({ ...lim.data, allowed_merchants: parse(lim.data.allowed_merchants), blocked_merchants: parse(lim.data.blocked_merchants), allowlist_only: !!lim.data.allowlist_only }); }, [lim.data]);
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (k, id) => setF({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] });
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await send('put', '/limits', f); toast('Limits saved'); } catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
  };
  return (<>
    <h1>Spending limits</h1><p className="sub">Hard limits. A payment over any of these is blocked, whatever its risk score.</p>
    <State loading={lim.loading || !f} error={lim.error} reload={lim.reload}>{f && <form className="card" onSubmit={save}>
      <div className="row" style={{ marginBottom: 16 }}>
        {[['max_transaction', 'Maximum per transaction (₹)'], ['daily_limit', 'Daily limit (₹)'], ['monthly_limit', 'Monthly limit (₹)']].map(([k, l]) => <div key={k}><label htmlFor={k}>{l}</label><input id={k} type="number" min="1" value={f[k]} onChange={num(k)} required /></div>)}</div>
      <div className="field"><label>Allowed merchants</label><div className="chips">{(mer.data || []).map((m) => <button type="button" key={m.id} className={`chip ${f.allowed_merchants.includes(m.id) ? 'on' : ''}`} onClick={() => toggle('allowed_merchants', m.id)}>{m.name}</button>)}</div></div>
      <div className="field"><label>Blocked merchants</label><div className="chips">{(mer.data || []).map((m) => <button type="button" key={m.id} className={`chip off-bad ${f.blocked_merchants.includes(m.id) ? 'on' : ''}`} onClick={() => toggle('blocked_merchants', m.id)}>{m.name}</button>)}</div></div>
      <div className="field"><label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)' }}><input type="checkbox" style={{ width: 'auto' }} checked={f.allowlist_only} onChange={(e) => setF({ ...f, allowlist_only: e.target.checked })} />Only pay allowed merchants (block everyone else)</label></div>
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save limits'}</button>
    </form>}</State>
  </>);
}
