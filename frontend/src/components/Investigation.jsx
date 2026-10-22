import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { api } from '../api.js'
import { useLive } from '../useLive.jsx'
import { Card, inr, num } from '../ui.jsx'

const STATUSES = ['open', 'investigating', 'confirmed_fraud', 'false_positive', 'closed']
const riskColor = (r) => (r == null ? '#94a3b8' : `hsl(${120 - 120 * Math.min(1, Math.max(0, r))}, 75%, 45%)`)

function GraphPane({ account, setAccount }) {
  const [input, setInput] = useState(account || '')
  const [hops, setHops] = useState(2)
  const [g, setG] = useState(null)
  const [err, setErr] = useState('')
  const [w, setW] = useState(600)
  const box = useRef(null)

  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setInput(account || '')
    if (!account) return
    setErr('')
    api.graph(account, hops).then(setG).catch((e) => { setG(null); setErr(e.message) })
  }, [account, hops])

  // the graph library mutates its input, so give it copies
  const data = useMemo(
    () => (g ? { nodes: g.nodes.map((n) => ({ ...n })), links: g.edges.map((e) => ({ ...e })) } : { nodes: [], links: [] }),
    [g]
  )

  const radius = (n) => 4 + Math.min(8, Math.sqrt((n.in_deg || 0) + (n.out_deg || 0)))
  const paint = (n, ctx, scale) => {
    const r = radius(n)
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = riskColor(n.risk); ctx.fill()
    if (n.is_known_mule) { ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#111827'; ctx.stroke() }
    if (g && n.id === g.center) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI)
      ctx.lineWidth = 2 / scale; ctx.strokeStyle = '#2563eb'; ctx.stroke()
    }
    ctx.font = `${10 / scale}px sans-serif`; ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'
    ctx.fillText(n.id, n.x, n.y + r + 9 / scale)
  }

  return (
    <Card
      title="Account network"
      right={
        <div className="row">
          <input placeholder="account id, e.g. Z001977" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && input.trim() && setAccount(input.trim())} />
          <select value={hops} onChange={(e) => setHops(Number(e.target.value))}>
            <option value={1}>1 hop</option><option value={2}>2 hops</option><option value={3}>3 hops</option>
          </select>
          <button className="btn primary" onClick={() => input.trim() && setAccount(input.trim())}>Load</button>
        </div>
      }
    >
      <div ref={box} className="graph-box">
        {err && <p className="err">{err}</p>}
        {!account && !err && <p className="muted">Enter an account id, or click “Investigate receiver” on an alert.</p>}
        <ForceGraph2D
          graphData={data} width={w} height={520}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={paint}
          nodePointerAreaPaint={(n, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, radius(n) + 2, 0, 2 * Math.PI); ctx.fill() }}
          nodeLabel={(n) => `${n.id} (${n.kind})<br/>age ${num(n.age_days, 1)} days · in ${n.in_deg} / out ${n.out_deg}<br/>risk ${num(n.risk, 2)}${n.is_known_mule ? '<br/><b>KNOWN MULE</b>' : ''}`}
          linkLabel={(l) => `${inr(l.amount)} × ${l.count ?? 1}`}
          linkColor={() => '#94a3b8'}
          linkDirectionalArrowLength={4} linkDirectionalArrowRelPos={1}
          onNodeClick={(n) => setAccount(n.id)}
        />
      </div>
      <p className="muted small">Colour = risk (green → red) · black outline = known mule · blue ring = centre · size = connections · click a node to re-centre.</p>
    </Card>
  )
}

function CasesPane({ setAccount }) {
  const { alerts, caseTick, refreshAlerts } = useLive()
  const [filter, setFilter] = useState('')
  const [cases, setCases] = useState([])
  const [sel, setSel] = useState(null)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const load = () => api.cases(filter || undefined).then(setCases).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [filter, caseTick])
  useEffect(() => { if (sel) api.getCase(sel.case_id).then(setSel).catch(() => {}) }, [caseTick])

  const openAlerts = alerts.filter((a) => !a.case_id).slice(0, 8)
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function create() {
    setErr('')
    try {
      const c = await api.createCase({ title: title || 'Untitled case', alert_ids: picked, assignee: 'analyst1' })
      setTitle(''); setPicked([]); setSel(c); load(); refreshAlerts()
    } catch (e) { setErr(e.message) }
  }
  async function patch(body) {
    setErr('')
    try {
      const c = await api.patchCase(sel.case_id, body)
      setSel(c); setNote(''); load()
    } catch (e) { setErr(e.message) }
  }

  return (
    <Card title="Cases" right={
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">all</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    }>
      {err && <p className="err">{err}</p>}

      <div className="newcase">
        <input placeholder="New case title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="small-list">
          {openAlerts.map((a) => (
            <label key={a.alert_id} className="check small">
              <input type="checkbox" checked={picked.includes(a.alert_id)} onChange={() => toggle(a.alert_id)} />
              #{a.alert_id} · {a.action} · {a.receiver} · {inr(a.amount)}
            </label>
          ))}
          {openAlerts.length === 0 && <span className="muted">No open alerts to attach.</span>}
        </div>
        <button className="btn primary" onClick={create}>Create case</button>
      </div>

      <div className="scroll short">
        <table className="clickable">
          <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Alerts</th></tr></thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.case_id} className={sel?.case_id === c.case_id ? 'selrow' : ''} onClick={() => setSel(c)}>
                <td>{c.case_id}</td><td>{c.title}</td><td>{c.status}</td><td>{c.alert_ids?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && <p className="muted">No cases yet.</p>}
      </div>

      {sel && (
        <div className="casebox">
          <h4>Case #{sel.case_id}: {sel.title}</h4>
          <div className="row">
            <select value={sel.status} onChange={(e) => patch({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="muted">assignee: {sel.assignee || '–'}</span>
          </div>
          <div className="row wrap">
            {(sel.alert_ids || []).map((id) => {
              const a = alerts.find((x) => x.alert_id === id)
              return (
                <button key={id} className="chip" onClick={() => a && setAccount(a.receiver)}>
                  #{id}{a ? ` → ${a.receiver}` : ''}
                </button>
              )
            })}
          </div>
          <div className="row">
            <input placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" disabled={!note.trim()} onClick={() => patch({ note })}>Add note</button>
          </div>
          <ul className="small-list">
            {(sel.events || []).slice().reverse().map((e, i) => (
              <li key={i}><span className="muted">{String(e.ts).replace('T', ' ').slice(0, 16)}</span> · {e.by}: {e.note}{e.status ? ` [${e.status}]` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

export default function Investigation() {
  const [sp, setSp] = useSearchParams()
  const account = sp.get('account') || ''
  const setAccount = (id) => setSp({ account: id })
  return (
    <div className="page grid-inv">
      <GraphPane account={account} setAccount={setAccount} />
      <CasesPane setAccount={setAccount} />
    </div>
  )
}