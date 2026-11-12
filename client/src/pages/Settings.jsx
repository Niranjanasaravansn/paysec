import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, send, errMsg } from '../api';
import { useLoad, State, useToast, when } from '../ui';
import { useTheme } from '../App';

export default function Settings() {
  const toast = useToast(); const { theme, toggle } = useTheme();
  const me = useLoad(() => get('/users/me')); const notes = useLoad(() => get('/notifications'));
  const [f, setF] = useState(null);
  useEffect(() => { if (me.data) setF({ name: me.data.name, notify_email: !!me.data.notify_email }); }, [me.data]);
  const save = async (e) => { e.preventDefault(); try { await send('put', '/users/me', f); toast('Profile saved'); } catch (x) { toast(errMsg(x), 'error'); } };
  return (<>
    <h1>Settings</h1><p className="sub">Profile, notifications and appearance.</p>
    <div className="grid g2">
      <State loading={me.loading || !f} error={me.error} reload={me.reload}>{f && <form className="card" onSubmit={save}><h2>Profile</h2>
        <div className="field"><label htmlFor="nm">Name</label><input id="nm" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div className="field"><label>Email</label><input value={me.data.email} disabled /></div>
        <div className="field"><label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)' }}><input type="checkbox" style={{ width: 'auto' }} checked={f.notify_email} onChange={(e) => setF({ ...f, notify_email: e.target.checked })} />Notify me when a payment needs approval</label></div>
        <button className="btn primary">Save changes</button></form>}</State>
      <div className="card"><h2>Appearance and spending</h2><button className="btn" onClick={toggle}>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</button>
        <p className="sub" style={{ marginTop: 14 }}>Limits and merchant rules live under <Link to="/limits">Spending limits</Link>.</p>
        <h2 style={{ marginTop: 18 }}>Notifications</h2><State loading={notes.loading} error={notes.error} reload={notes.reload} empty={notes.data && !notes.data.length} emptyText="No notifications yet.">
          <ul className="reasons">{(notes.data || []).slice(0, 8).map((n) => <li key={n.id}>{n.message} <span className="sub">({when(n.created_at)})</span></li>)}</ul></State></div>
    </div>
  </>);
}
