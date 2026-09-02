import { HashRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store.jsx'
import Roster from './pages/Roster.jsx'
import Profile from './pages/Profile.jsx'
import Ladder from './pages/Ladder.jsx'
import Logs from './pages/Logs.jsx'
import PersonForm from './pages/PersonForm.jsx'
import ToolAdmin from './pages/ToolAdmin.jsx'

function TopBar() {
  const store = useStore()
  const cls = ({ isActive }) => (isActive ? 'on' : undefined)

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="Neat Team #1943" />
      </Link>

      <nav className="nav">
        <NavLink to="/" className={cls} end>
          חברי הצוות
        </NavLink>
        <NavLink to="/ladder" className={cls}>
          סולם ההתקדמות
        </NavLink>
        <NavLink to="/logs" className={cls}>
          יומן
        </NavLink>
        {store.isMentor && (
          <NavLink to="/tools" className={cls}>
            ניהול כלים
          </NavLink>
        )}
      </nav>

      <div className="mentor-chip">
        {store.isMentor ? (
          <>
            <span>{store.user.displayName}</span>
            <button className="btn sm" onClick={store.signOut}>
              יציאה
            </button>
          </>
        ) : store.user ? (
          <>
            <span>אין הרשאת מנטור</span>
            <button className="btn sm" onClick={store.signOut}>
              יציאה
            </button>
          </>
        ) : (
          <button className="btn sm" onClick={store.signIn}>
            כניסת מנטורים
          </button>
        )}
      </div>
    </header>
  )
}

function Shell() {
  const store = useStore()
  return (
    <div className="shell">
      <TopBar />
      {store.error && (
        <div className="panel">
          <h3>לא ניתן לטעון את הנתונים</h3>
          <p className="empty">בדקו את החיבור לאינטרנט ונסו לרענן.</p>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Roster />} />
        <Route path="/p/:id" element={<Profile />} />
        <Route path="/ladder" element={<Ladder />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/tools" element={<ToolAdmin />} />
        <Route path="/new" element={<PersonForm />} />
        <Route path="/edit/:id" element={<PersonForm />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}
