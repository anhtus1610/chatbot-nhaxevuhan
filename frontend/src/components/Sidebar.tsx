import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useChat } from '../context/ChatContext'
import { 
  MessageSquare, 
  MapPin, 
  Calendar, 
  Menu,
  Plus,
  MessageCircle
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navigate = useNavigate()
  const { sessions, currentSessionId, createNewChat, selectSession } = useChat()

  const navItems = [
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: MapPin, label: 'Kiểm tra tuyến', path: '/route-check' },
    { icon: Calendar, label: 'Lịch chạy', path: '/schedule' },
  ]

  return (
    <aside className={cn('sidebar', isCollapsed && 'collapsed')}>
      <div className="sidebar-header">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="icon-btn"
        >
          <Menu size={24} />
        </button>
      </div>

      <button 
        onClick={() => {
          createNewChat()
          navigate('/chat')
        }}
        className={cn(
          "new-chat-btn",
          isCollapsed && "collapsed"
        )}
      >
        <Plus size={20} />
        {!isCollapsed && <span className="new-chat-text">Cuộc trò chuyện mới</span>}
      </button>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'nav-item',
              isCollapsed && 'collapsed',
              isActive && 'active'
            )}
          >
            <item.icon size={20} />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!isCollapsed && sessions.length > 0 && (
        <div className="sidebar-history">
          <h3 className="history-title">Gần đây</h3>
          <div className="history-list">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  selectSession(session.id)
                  navigate('/chat')
                }}
                className={cn(
                  'history-item',
                  currentSessionId === session.id && 'active'
                )}
              >
                <MessageCircle size={14} className="shrink-0" />
                <span className="truncate">{session.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </aside>
  )
}
