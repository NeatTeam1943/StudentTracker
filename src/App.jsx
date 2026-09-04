import { HashRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store.jsx'
import Roster from './pages/Roster.jsx'
import Profile from './pages/Profile.jsx'
import Ladder from './pages/Ladder.jsx'
import Logs from './pages/Logs.jsx'
import PersonForm from './pages/PersonForm.jsx'
import ToolAdmin from './pages/ToolAdmin.jsx'
import Mentors from './pages/Mentors.jsx'
import Teams from './pages/Teams.jsx'

function TopBar() {
  const store = useStore()
  const cls = ({ isActive }) => (isActive ? 'on' : undefined)

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="Neat Team #1943" />
      </Link>

      <nav className="nav">
        {store.teams?.length > 1 &&
          store.teams.map((t) => (
            <button
              key={t.id}
              className={`team-pill${t.id === store.teamId ? ' on' : ''}`}
              onClick={() => store.setTeam(t.id)}
            >
              {t.name}
            </button>
          ))}
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
            ניהול {store.team?.itemNoun ?? 'כלים'}
          </NavLink>
        )}
        {store.isMentor && (
          <NavLink to="/teams" className={cls}>
            צוותים
          </NavLink>
        )}
        {/* Visible to anyone signed in, not just mentors — a pending mentor has
            to be able to get back here to send their request. */}
        {store.user && (
          <NavLink to="/mentors" className={cls}>
            מנטורים
            {store.requests.length > 0 && <span className="badge-count">{store.requests.length}</span>}
          </NavLink>
        )}
      </nav>

      <div className="mentor-chip">
        {store.user ? (
          <>
            {!store.isMentor && (
              <Link className="btn sm" to="/mentors">
                בקשת הרשאה
              </Link>
            )}
            <span className="who-name">{store.user.displayName}</span>
            <button className="btn sm" onClick={store.signOut}>
              יציאה
            </button>
          </>
        ) : (
          <Link className="btn sm" to="/mentors">
            כניסת מנטורים
          </Link>
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
        <Route path="/mentors" element={<Mentors />} />
        <Route path="/teams" element={<Teams />} />
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
