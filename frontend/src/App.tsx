import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import AdminSidebar from './components/AdminSidebar'
import ProtectedRoute from './components/ProtectedRoute'
import RouteChecker from './pages/RouteChecker'
import ScheduleViewer from './pages/ScheduleViewer'
import GeminiChat from './pages/GeminiChat'
import KnowledgeEditor from './pages/KnowledgeEditor'
import BookingManager from './pages/BookingManager'
import AdminLogin from './pages/AdminLogin'
import { ChatProvider } from './context/ChatContext'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Admin login — layout riêng hoàn toàn */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin layout — dùng AdminSidebar */}
            <Route path="/admin/*" element={
              <div className="app-layout">
                <AdminSidebar />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<Navigate to="/admin/bookings" replace />} />
                    <Route path="/bookings" element={
                      <ProtectedRoute>
                        <BookingManager />
                      </ProtectedRoute>
                    } />
                    <Route path="/knowledge" element={
                      <ProtectedRoute>
                        <KnowledgeEditor />
                      </ProtectedRoute>
                    } />
                  </Routes>
                </main>
              </div>
            } />

            {/* User layout — dùng Sidebar chính */}
            <Route path="/*" element={
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
            } />
          </Routes>
        </BrowserRouter>
      </ChatProvider>
    </AuthProvider>
  )
}

export default App
