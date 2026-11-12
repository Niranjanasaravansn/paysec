import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { send, errMsg } from '../api';
import { useToast } from '../ui';

export default function Login() {
  const nav = useNavigate(), toast = useToast();
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({ name: '', email: 'demo@paysec.dev', password: 'Demo@1234' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await send('post', reg ? '/auth/register' : '/auth/login', f); localStorage.setItem('token', r.token); nav('/'); }
    catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="login"><form className="card" onSubmit={submit}>
      <h1>Pay<span style={{ color: 'var(--brand)' }}>Sec</span></h1>
      <p className="sub">{reg ? 'Create your account' : 'Sign in to review and control AI payments'}</p>
      {reg && <div className="field"><label htmlFor="n">Name</label><input id="n" value={f.name} onChange={set('name')} required /></div>}
      <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" value={f.email} onChange={set('email')} required /></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" minLength={8} value={f.password} onChange={set('password')} required /></div>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Please wait…' : reg ? 'Create account' : 'Sign in'}</button>
      <p className="sub" style={{ marginTop: 14, textAlign: 'center' }}><a href="#" onClick={(e) => { e.preventDefault(); setReg(!reg); }}>{reg ? 'I already have an account' : 'Create an account'}</a></p>
    </form></div>
  );
}
