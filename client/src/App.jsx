import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { get } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import RiskAnalysis from './pages/RiskAnalysis';
import Approvals from './pages/Approvals';
import Merchants from './pages/Merchants';
import Limits from './pages/Limits';
import Agent from './pages/Agent';
import Settings from './pages/Settings';

const Theme = createContext();
export const useTheme = () => useContext(Theme);

function Layout() {
  const nav = useNavigate();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const { toggle, theme } = useTheme();
  useEffect(() => { get('/approvals/pending').then((r) => setPending(r.length)).catch(() => {}); }, []);
  const logout = () => { localStorage.removeItem('token'); nav('/login'); };
  const links = [['/', 'Dashboard'], ['/agent', 'AI agent'], ['/transactions', 'Monitoring'], ['/risk', 'Risk analysis'], ['/approvals', 'Approvals'], ['/merchants', 'Merchants'], ['/limits', 'Spending limits'], ['/history', 'History'], ['/settings', 'Settings']];
  return (
    <div className="shell">
      <div className="top"><b>Pay<span style={{ color: 'var(--brand)' }}>Sec</span></b><button className="btn" onClick={() => setOpen(!open)} aria-label="Menu">Menu</button></div>
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">Pay<b>Sec</b></div>
        <nav className="nav">{links.map(([to, name]) => (
          <NavLink key={to} to={to} end={to === '/'}>{name}{to === '/approvals' && pending > 0 && <span className="count">{pending}</span>}</NavLink>))}</nav>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <button className="btn" onClick={toggle}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main"><Outlet context={{ setPending }} /></main>
    </div>
  );
}

const Protected = () => (localStorage.getItem('token') ? <Layout /> : <Navigate to="/login" replace />);

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  return (
    <Theme.Provider value={{ theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/transactions" element={<Transactions mode="monitor" />} />
          <Route path="/history" element={<Transactions mode="history" />} />
          <Route path="/risk" element={<RiskAnalysis />} />
          <Route path="/risk/:id" element={<RiskAnalysis />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/merchants" element={<Merchants />} />
          <Route path="/limits" element={<Limits />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Theme.Provider>
  );
}
