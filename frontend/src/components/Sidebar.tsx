import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  MessageSquare, 
  MapPin, 
  Calendar, 
  Settings, 
  Menu,
  Plus
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

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

      <button className={cn(
        "new-chat-btn",
        isCollapsed && "collapsed"
      )}>
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

      <div className="sidebar-footer">
        <div className={cn(
          "nav-item cursor-pointer",
          isCollapsed && "collapsed"
        )}>
          <Settings size={20} />
          {!isCollapsed && <span>Cài đặt</span>}
        </div>
      </div>
    </aside>
  )
}
