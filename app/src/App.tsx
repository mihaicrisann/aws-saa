import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Lectures from './pages/Lectures'
import LectureReader from './pages/LectureReader'
import Exam from './pages/Exam'
import Drill from './pages/Drill'
import Cards from './pages/Cards'
import Mistakes from './pages/Mistakes'
import Cheatsheet from './pages/Cheatsheet'
import Progress from './pages/Progress'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learn" element={<Lectures />} />
        <Route path="/learn/:id" element={<LectureReader />} />
        <Route path="/drill" element={<Drill />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/mistakes" element={<Mistakes />} />
        <Route path="/cheatsheet" element={<Cheatsheet />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      {/* the exam runs outside the shell — no navigation while the clock is live */}
      <Route path="/exam" element={<Exam />} />
    </Routes>
  )
}
