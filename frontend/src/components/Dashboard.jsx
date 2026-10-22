import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api.js'
import { useLive } from '../useLive.jsx'
import { ActionBadge, Card, Kpi, Truth, inr, num, timeOf } from '../ui.jsx'
import TracePanel from './TracePanel.jsx'
import ThresholdPanel from './ThresholdPanel.jsx'

function ReplayControls() {
  const { replay, setReplay } = useLive()
  const [speed, setSpeed] = useState(600)
  const [err, setErr] = useState('')

  useEffect(() => { api.replay().then(setReplay).catch(() => {}) }, [])
  useEffect(() => { if (replay?.speed) setSpeed(replay.speed) }, [replay?.speed])

  const send = (action, sp) =>
    api.setReplay({ action, speed: sp }).then(setReplay).catch((e) => setErr(e.message))
  const running = replay?.running

  return (
    <div className="row">
      <button className="btn primary" onClick={() => send(running ? 'pause' : 'start', speed)}>
        {running ? '⏸ Pause' : '▶ Start replay'}
      </button>
      <select value={speed} onChange={(e) => {
        const v = Number(e.target.value)
        setSpeed(v)
        if (running) send('speed', v)
      }}>
        {[60, 600, 2000, 5000, 20000].map((v) => <option key={v} value={v}>{v}× speed</option>)}
      </select>
      {replay && (
        <span className="muted">
          {replay.replay_ts?.replace('T', ' ')} · {num(replay.progress_pct, 1)}%{replay.finished ? ' · finished (restart backend for a fresh run)' : ''}
        </span>
      )}
      {err && <span className="err">{err}</span>}
    </div>
  )
}

export default function Dashboard() {
  const { stats, latencyHist, txns, alerts, demoMode } = useLive()
  const [sp, setSp] = useSearchParams()
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(() =>
    sp.get('trace')
      ? { txnId: Number(sp.get('trace')), alertId: sp.get('alert') ? Number(sp.get('alert')) : null }
      : null
  )

  const close = () => { setOpen(null); setSp({}) }
  const rows = alerts.filter((a) => !filter || a.action === filter)
  const a = stats?.actions || {}
  const k = stats?.known_outcomes || {}
  const lat = stats?.latency_ms || {}

  return (
    <div className="page">
      <Card title="Live replay" right={<ReplayControls />}>
        <div className="kpis">
          <Kpi label="Transactions scored" value={num(stats?.txns_scored, 0)} sub={`${num(stats?.txns_per_sec, 1)} / sec`} />
          <Kpi label="Allowed" value={num(a.allow, 0)} tone="allow" />
          <Kpi label="Warned" value={num(a.warn, 0)} tone="warn" />
          <Kpi label="Held" value={num(a.hold, 0)} tone="hold" />
          <Kpi label="Latency p50 / p99" value={`${num(lat.p50, 2)} / ${num(lat.p99, 2)} ms`} sub={`budget ${lat.budget ?? 200} ms`} />
          {demoMode && (
            <Kpi label="Fraud caught / missed" value={`${num(k.fraud_caught, 0)} / ${num(k.fraud_missed, 0)}`} sub={`${num(k.false_alarms, 0)} false alarms`} />
          )}
        </div>
      </Card>

      <div className="grid2">
        <Card title="Scoring latency (ms, log scale)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={latencyHist} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" hide />
              <YAxis scale="log" domain={[0.1, 300]} allowDataOverflow ticks={[0.1, 1, 10, 100, 200]} />
              <Tooltip formatter={(v) => `${num(v, 2)} ms`} />
              <Legend />
              <ReferenceLine y={200} stroke="#dc2626" strokeDasharray="6 4" label={{ value: '200 ms budget', fill: '#dc2626', fontSize: 11 }} />
              <Line dataKey="p50" stroke="#16a34a" dot={false} isAnimationActive={false} />
              <Line dataKey="p95" stroke="#f59e0b" dot={false} isAnimationActive={false} />
              <Line dataKey="p99" stroke="#dc2626" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Live feed">
          <div className="feed">
            {txns.slice(0, 14).map((t) => (
              <div key={`${t.txn_id}-${t.ts}`} className="feed-row">
                <span className="muted">{timeOf(t.ts)}</span>
                <span>{t.sender} → {t.receiver}</span>
                <span>{inr(t.amount)}</span>
                <span>{num(t.risk, 0)}</span>
                <ActionBadge action={t.action} />
              </div>
            ))}
            {txns.length === 0 && <p className="muted">No transactions yet. Press “Start replay”.</p>}
          </div>
        </Card>
      </div>

      <Card
        title={`Alerts (${rows.length})`}
        right={
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">all</option><option value="hold">hold</option><option value="warn">warn</option>
          </select>
        }
      >
        <div className="scroll tall">
          <table className="clickable">
            <thead>
              <tr>
                <th>Time</th><th>Sender → Receiver</th><th>Amount</th><th>Risk</th><th>Action</th>
                <th>Top reason</th>{demoMode && <th>Truth</th>}<th>Case</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((al) => (
                <tr key={al.alert_id ?? `${al.txn_id}`} onClick={() => setOpen({ txnId: al.txn_id, alertId: al.alert_id })}>
                  <td>{timeOf(al.ts)}</td>
                  <td>{al.sender} → {al.receiver}</td>
                  <td>{inr(al.amount)}</td>
                  <td>{num(al.risk, 1)}</td>
                  <td><ActionBadge action={al.action} /></td>
                  <td>
                    {al.override && <span className="badge hold">{al.override}</span>}{' '}
                    {al.reasons?.[0]?.text?.en || al.reasons?.[0]?.id || ''}
                  </td>
                  {demoMode && <td><Truth truth={al.truth} action={al.action} /></td>}
                  <td>{al.case_id ? `#${al.case_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted">No alerts yet.</p>}
        </div>
      </Card>

      <ThresholdPanel />

      {open && <TracePanel txnId={open.txnId} alertId={open.alertId} onClose={close} />}
    </div>
  )
}