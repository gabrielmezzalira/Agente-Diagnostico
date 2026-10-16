import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SessionSetupPage from './pages/SessionSetupPage'
import SessionActivePage from './pages/SessionActivePage'
import PricingListPage from './pages/PricingListPage'
import PricingEditorPage from './pages/PricingEditorPage'
import SessionsPage from './pages/SessionsPage'
import ExtensionPage from './pages/ExtensionPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects/new" element={<ProjectFormPage />} />
      <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/projects/:id/sessions/new" element={<SessionSetupPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
      <Route path="/sessions/:sessionId" element={<SessionActivePage />} />
      <Route path="/extension" element={<ExtensionPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/projects/:id/pricings" element={<PricingListPage />} />
      <Route path="/pricings/:id" element={<PricingEditorPage />} />
    </Routes>
  )
}

export default App
