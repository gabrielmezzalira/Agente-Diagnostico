import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SessionSetupPage from './pages/SessionSetupPage'
import SessionActivePage from './pages/SessionActivePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects/new" element={<ProjectFormPage />} />
      <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/projects/:id/sessions/new" element={<SessionSetupPage />} />
      <Route path="/sessions/:sessionId" element={<SessionActivePage />} />
    </Routes>
  )
}

export default App
