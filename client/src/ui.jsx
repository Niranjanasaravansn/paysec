import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { errMsg } from './api';

export const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const when = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const levelOf = (s) => (s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 30 ? 'MEDIUM' : 'LOW');
export const label = (s) => String(s).replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v || []);

const ToastCtx = createContext();
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random(); setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
  }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts" role="status">{items.map((i) => <div key={i.id} className={`toast ${i.type}`}>{i.msg}</div>)}</div></ToastCtx.Provider>;
}

export const Badge = ({ v }) => <span className={`badge b-${v}`}>{label(v)}</span>;
export const Risk = ({ score }) => <span className={`badge b-${levelOf(score)}`}>{score} · {label(levelOf(score))}</span>;

export function Gauge({ score, size = 180 }) {
  const r = 70, c = Math.PI * r, p = Math.min(100, Math.max(0, score)) / 100;
  const col = { LOW: 'var(--ok)', MEDIUM: 'var(--warn)', HIGH: 'var(--warn)', CRITICAL: 'var(--bad)' }[levelOf(score)];
  return (
    <svg width={size} viewBox="0 0 180 110" role="img" aria-label={`Risk score ${score} out of 100`}>
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="var(--neutral-soft)" strokeWidth="14" strokeLinecap="round" />
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke={col} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
      <text x="90" y="82" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--ink)">{score}</text>
      <text x="90" y="102" textAnchor="middle" fontSize="12" fill="var(--muted)">{label(levelOf(score))} risk</text>
    </svg>
  );
}

export function Modal({ onClose, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-bg" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}

export function useLoad(fn, deps = []) {
  const [s, set] = useState({ data: null, loading: true, error: null });
  const toast = useToast();
  const reload = useCallback(() => {
    set((x) => ({ ...x, loading: true, error: null }));
    fn().then((data) => set({ data, loading: false, error: null }))
      .catch((e) => { set({ data: null, loading: false, error: errMsg(e) }); });
    // eslint-disable-next-line
  }, deps);
  useEffect(reload, [reload]);
  return { ...s, reload, toast };
}

export function State({ loading, error, empty, emptyText, reload, children }) {
  if (loading) return <div>{[1, 2, 3].map((i) => <div key={i} className="skel" />)}</div>;
  if (error) return <div className="empty err">{error} <button className="btn" onClick={reload}>Try again</button></div>;
  if (empty) return <div className="empty">{emptyText}</div>;
  return children;
}
