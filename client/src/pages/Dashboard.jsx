import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { get } from '../api';
import { useLoad, State, Badge, Risk, Gauge, inr, when } from '../ui';

export default function Dashboard() {
  const { data, loading, error, reload } = useLoad(() => get('/dashboard'));
  const s = data?.summary;
  const stats = s && [['Total transactions', s.total], ['Approved', s.approved || 0], ['Blocked', s.blocked || 0], ['Pending approval', s.pending || 0], ['Total spending', inr(s.totalSpending)]];
  return (<>
    <h1>Dashboard</h1><p className="sub">Every AI payment, checked before it moves money.</p>
    <State loading={loading} error={error} reload={reload} empty={data && s.total === 0} emptyText={<>No payments yet. <Link to="/agent">Send your first agent request</Link>.</>}>
      {data && <div className="grid">
        <div className="grid g4">{stats.map(([l, v]) => <div className="card stat" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>)}</div>
        <div className="grid g2">
          <div className="card"><h2>Last 14 days</h2><ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.daily.map((d) => ({ ...d, day: String(d.day).slice(5, 10), approved: +d.approved, blocked: +d.blocked, pending: +d.pending }))}>
              <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="day" stroke="var(--muted)" /><YAxis allowDecimals={false} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)' }} /><Legend />
              <Bar dataKey="approved" stackId="a" fill="#12a36f" /><Bar dataKey="pending" stackId="a" fill="#f0a020" /><Bar dataKey="blocked" stackId="a" fill="#d9413d" /></BarChart></ResponsiveContainer></div>
          <div className="card" style={{ textAlign: 'center' }}><h2>Overall transaction risk</h2><Gauge score={s.avgRisk} size={240} /><p className="sub">Average risk score across all requests</p></div>
        </div>
        <div className="card"><h2>Recent transactions</h2><div className="scroll"><table><thead><tr><th>Merchant</th><th>Amount</th><th>When</th><th>Risk</th><th>Status</th></tr></thead>
          <tbody>{data.recent.map((t) => <tr key={t.public_id}><td>{t.merchant}</td><td>{inr(t.amount)}</td><td>{when(t.created_at)}</td><td><Risk score={t.risk_score} /></td><td><Badge v={t.status} /></td></tr>)}</tbody></table></div></div>
      </div>}
    </State>
  </>);
}
