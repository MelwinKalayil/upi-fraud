import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { LiveProvider, useLive } from './useLive.jsx'
import PhoneSimulator from './components/PhoneSimulator.jsx'
import DemoControl from './components/DemoControl.jsx'
import Dashboard from './components/Dashboard.jsx'
import Investigation from './components/Investigation.jsx'
import Evaluation from './components/Evaluation.jsx'

const link = ({ isActive }) => (isActive ? 'active' : '')

// Rarely needed pages live here so the main menu stays short.
function MoreMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="more">
      <button className="more-btn" onClick={() => setOpen((o) => !o)}>
        More ▾
      </button>
      {open && (
        <>
          <div className="more-bg" onClick={() => setOpen(false)} />
          <div className="more-menu" onClick={() => setOpen(false)}>
            <NavLink to="/evaluation" className={link}>Model evaluation</NavLink>
            <NavLink to="/simulator" className={link}>Phone simulator (old, in-browser)</NavLink>
          </div>
        </>
      )}
    </div>
  )
}

function Header() {
  const { connected, demoMode, setDemoMode } = useLive()
  return (
    <header className="top">
      <div className="brand">🛡️ UPI Fraud Alert</div>
      <nav>
        <NavLink to="/demo" className={link}>Demo control</NavLink>
        <NavLink to="/dashboard" className={link}>Live monitor</NavLink>
        <NavLink to="/investigate" className={link}>Investigation</NavLink>
        <MoreMenu />
      </nav>
      <div className="top-right">
        <label className="check small" title="Shows the true fraud labels from the dataset next to the model's decisions">
          <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
          Show true fraud labels
        </label>
        <span className={`pill ${connected ? 'on' : 'off'}`}>{connected ? '● Connected' : '● Offline'}</span>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <LiveProvider>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/demo" replace />} />
          <Route path="/demo" element={<DemoControl />} />
          <Route path="/simulator" element={<PhoneSimulator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/investigate" element={<Investigation />} />
          <Route path="/evaluation" element={<Evaluation />} />
        </Routes>
      </main>
    </LiveProvider>
  )
}