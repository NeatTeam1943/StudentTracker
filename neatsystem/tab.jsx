/**
 * Trainings (StudentTracker) as a NeatSystem tab — tab contract 1.
 * NeatSystem finds this file at systems/<folder>/neatsystem/tab.jsx, mounts
 * Root at /trainings/*, shows HomeCard on the home screen, and reads
 * trainings_api.profile_v1 for the profile page. See NeatSystem src/core/tabs.ts.
 */
import { Route, Routes, Navigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { Empty, Spinner } from '@neatsystem/kit'
import { TrainingsProvider, useTr } from '../src/model/store.jsx'
import { sharedMemoryBackend } from '../src/model/memory.js'
import { Main } from '../src/ui/Main.jsx'
import { PersonPage } from '../src/ui/Person.jsx'
import { ItemPage } from '../src/ui/Item.jsx'
import { ManagePage } from '../src/ui/Manage.jsx'
import { HomeCard } from '../src/ui/HomeCard.jsx'
import '../src/ui/trainings.css'

function Gate({ children }) {
  const { M, error, reload } = useTr()
  if (error) return <div className="page"><Empty icon={GraduationCap} title="ההכשרות לא נטענו">{error.message} · <button type="button" className="linkish" onClick={reload}>לנסות שוב</button></Empty></div>
  if (!M) return <Spinner />
  return children
}

function Root({ host }) {
  return (
    <TrainingsProvider host={host}>
      <Gate>
        <Routes>
          <Route index element={<Main />} />
          <Route path="p/:id" element={<PersonPage />} />
          <Route path="m/:id" element={<ItemPage />} />
          <Route path="manage" element={<ManagePage />} />
          <Route path="*" element={<Navigate to={host.to('/')} replace />} />
        </Routes>
      </Gate>
    </TrainingsProvider>
  )
}

function Home({ host }) {
  return <TrainingsProvider host={host}><HomeCard /></TrainingsProvider>
}

export default {
  contract: 1,
  id: 'trainings',
  label: 'הכשרות',
  icon: GraduationCap,
  order: 30,
  dock: 2,
  Root,
  home: [{ id: 'next', order: 40, column: 'main', Component: Home }],
  profile: { schema: 'trainings_api', fn: 'profile_v1' },
  mock: {
    profile: (user, ctx) => sharedMemoryBackend().profile(user, ctx),
    // same list as hub.register_permissions in supabase/migrations/0001_trainings.sql
    permissions: [
      { key: 'trainings.certify_all', label: 'הסמכה בכל קטגוריות ההכשרות', grp: 'הכשרות', sort: 1, roles: ['captain', 'mentor', 'admin'] },
      { key: 'trainings.edit_catalog', label: 'עריכת פריטים, עמודות וסולמות בכל הקטגוריות', grp: 'הכשרות', sort: 2, roles: ['captain', 'mentor', 'admin'] },
      { key: 'trainings.manage', label: 'ניהול הכשרות: מאשרים, נעילת רש"צים, הסמכות מיוחדות, ניקוי יומן', grp: 'הכשרות', sort: 3, roles: ['mentor'] },
    ],
  },
}
