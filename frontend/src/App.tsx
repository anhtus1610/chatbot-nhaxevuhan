import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import RouteChecker from './pages/RouteChecker'
import ScheduleViewer from './pages/ScheduleViewer'
import GeminiChat from './pages/GeminiChat'
import { ChatProvider } from './context/ChatContext'

function App() {
  return (
    <ChatProvider>
      <BrowserRouter>
        <div className="app-layout">
        <Sidebar />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<GeminiChat />} />
            <Route path="/route-check" element={<RouteChecker />} />
            <Route path="/schedule" element={<ScheduleViewer />} />
          </Routes>
        </main>
      </div>
      </BrowserRouter>
    </ChatProvider>
  )
}

export default App

