import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * Chặn truy cập nếu chưa đăng nhập admin.
 * Redirect về /admin/login.
 */
export default function ProtectedRoute({ children }: Props) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
