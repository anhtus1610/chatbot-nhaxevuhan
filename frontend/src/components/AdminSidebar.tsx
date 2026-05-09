import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Menu,
  BookOpen,
  LogOut,
  ShieldCheck,
  Users
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()

  const adminNavItems = [
    { icon: Users, label: 'Quản lý đặt xe', path: '/admin/bookings' },
    { icon: BookOpen, label: 'Quản lý tri thức', path: '/admin/knowledge' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/chat')
  }

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

      {/* Nav admin */}
      <nav className="sidebar-nav" style={{ marginTop: '20px' }}>
        {!isCollapsed && (
          <div className="sidebar-section-label">
            <ShieldCheck size={12} /> Bảng điều khiển Admin
          </div>
        )}

        {adminNavItems.map((item) => (
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

      {/* Footer / Đăng xuất */}
      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className={cn('nav-item', 'logout-btn', isCollapsed && 'collapsed')}
          title="Đăng xuất admin"
        >
          <LogOut size={20} />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  )
}
