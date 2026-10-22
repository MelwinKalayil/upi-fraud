import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { LiveProvider, useLive } from './useLive.jsx'
import PhoneSimulator from './components/PhoneSimulator.jsx'
import Dashboard from './components/Dashboard.jsx'
import Investigation from './components/Investigation.jsx'
import Evaluation from './components/Evaluation.jsx'

function Header() {
  const { connected, demoMode, setDemoMode } = useLive()
  const link = ({ isActive }) => (isActive ? 'active' : '')
  return (
    <header className="top">
      <div className="brand">🛡️ UPI Fraud Alert</div>
      <nav>
        <NavLink to="/simulator" className={link}>Payment simulator</NavLink>
        <NavLink to="/dashboard" className={link}>Live dashboard</NavLink>
        <NavLink to="/investigate" className={link}>Investigation</NavLink>
        <NavLink to="/evaluation" className={link}>Evaluation</NavLink>
      </nav>
      <div className="top-right">
        <label className="check small">
          <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
          Demo mode (show true labels)
        </label>
        <span className={`pill ${connected ? 'on' : 'off'}`}>{connected ? 'live' : 'disconnected'}</span>
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
          <Route path="/" element={<Navigate to="/simulator" replace />} />
          <Route path="/simulator" element={<PhoneSimulator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/investigate" element={<Investigation />} />
          <Route path="/evaluation" element={<Evaluation />} />
        </Routes>
      </main>
    </LiveProvider>
  )
}