import { useState, type FormEvent, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const { login, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  // Nếu đã đăng nhập, tự động chuyển hướng
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/bookings', { replace: true })
    }
  }, [isAdmin, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.')
      return
    }
    setLoading(true)
    setError('')

    // Giả lập delay nhỏ để UX tự nhiên hơn
    await new Promise(r => setTimeout(r, 600))

    const ok = login(username.trim(), password)
    if (!ok) {
      setLoading(false)
      setError('Tài khoản hoặc mật khẩu không đúng.')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } else {
      navigate('/admin/bookings', { replace: true })
    }
  }

  return (
    <div className="admin-login-page">
      <div className={`admin-login-card ${shake ? 'shake' : ''}`}>

        {/* Icon */}
        <div className="admin-login-icon">
          <Shield size={32} />
        </div>

        <h1 className="admin-login-title">Đăng nhập Admin</h1>
        <p className="admin-login-subtitle">
          Khu vực quản lý tri thức — chỉ dành cho nhân viên vận hành Nhà xe Vũ Hán.
        </p>

        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>

          {/* Username */}
          <div className="form-group">
            <label htmlFor="admin-username">Tên đăng nhập</label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              placeholder="Nhập tên đăng nhập"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="admin-password">Mật khẩu</label>
            <div className="admin-password-wrapper">
              <input
                id="admin-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                disabled={loading}
              />
              <button
                type="button"
                className="admin-toggle-pass"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="admin-login-error">
              <Lock size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="admin-login-submit"
            type="submit"
            className="btn btn-primary admin-login-btn"
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
