import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, BellRing, Phone, X, CheckCheck, MessageCircle, Clock } from 'lucide-react'
import api from '../services/api'

interface CskhRequest {
  id: string
  ticket_id: string
  reason: string
  phone?: string
  name?: string
  createdAt: string
  isRead: boolean
}

export default function CskhNotification() {
  const [requests, setRequests] = useState<CskhRequest[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<CskhRequest[]>([])
  const prevIdsRef = useRef<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get('/v1/admin/cskh')
      const { requests: newRequests, unreadCount: count } = response.data

      // Detect truly new requests to trigger toast
      const incoming = (newRequests as CskhRequest[]).filter(
        r => !r.isRead && !prevIdsRef.current.has(r.id)
      )
      if (incoming.length > 0 && prevIdsRef.current.size > 0) {
        setToasts(prev => [...prev, ...incoming])
      }
      // Update known IDs
      prevIdsRef.current = new Set((newRequests as CskhRequest[]).map(r => r.id))

      setRequests(newRequests)
      setUnreadCount(count)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 5000)
    return () => clearInterval(interval)
  }, [fetchRequests])

  // Close toast after 6s
  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => setToasts(prev => prev.slice(1)), 6000)
    return () => clearTimeout(t)
  }, [toasts])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (id: string) => {
    await api.patch(`/v1/admin/cskh/${encodeURIComponent(id)}/read`)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, isRead: true } : r))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await api.patch('/v1/admin/cskh/read-all')
    setRequests(prev => prev.map(r => ({ ...r, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <>
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map((t, i) => (
          <div key={t.id} style={{
            backgroundColor: '#1f2937', border: '1px solid #f59e0b',
            borderLeft: '4px solid #f59e0b', borderRadius: '12px',
            padding: '16px', minWidth: '300px', maxWidth: '380px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            animation: 'slideInRight 0.3s ease-out',
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BellRing size={18} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '14px' }}>Khách cần gặp CSKH!</span>
              </div>
              <button onClick={() => setToasts(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ color: '#d1d5db', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>{t.reason}</p>
            {(t.name || t.phone) && (
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                {t.name && <span>👤 {t.name}</span>}
                {t.phone && <span><Phone size={11} style={{ verticalAlign: 'middle' }} /> {t.phone}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bell Icon */}
      <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setOpen(prev => !prev)}
          style={{
            position: 'relative', background: 'none', border: '1px solid #3b82f6',
            borderRadius: '8px', padding: '8px', cursor: 'pointer',
            color: unreadCount > 0 ? '#f59e0b' : '#60a5fa',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', height: '38px', width: '38px'
          }}
          title="Thông báo CSKH"
        >
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-6px', right: '-6px',
              backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700,
              borderRadius: '50%', width: '20px', height: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #111827'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px',
            width: '380px', maxHeight: '480px', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', zIndex: 9998
          }}>
            {/* Header */}
            <div style={{
              padding: '16px', borderBottom: '1px solid #374151',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} color="#f59e0b" />
                <span style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '15px' }}>Yêu cầu CSKH</span>
                {unreadCount > 0 && (
                  <span style={{
                    backgroundColor: '#f59e0b', color: '#000', fontSize: '11px',
                    fontWeight: 700, borderRadius: '10px', padding: '2px 8px'
                  }}>{unreadCount} mới</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <CheckCheck size={14} /> Đọc tất cả
                </button>
              )}
            </div>

            {/* List */}
            {requests.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                <Bell size={32} strokeWidth={1} style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Chưa có yêu cầu nào</p>
              </div>
            ) : (
              requests.map(r => (
                <div
                  key={r.id}
                  onClick={() => !r.isRead && markRead(r.id)}
                  style={{
                    padding: '14px 16px', borderBottom: '1px solid #374151', cursor: r.isRead ? 'default' : 'pointer',
                    backgroundColor: r.isRead ? 'transparent' : 'rgba(245, 158, 11, 0.05)',
                    transition: 'background 0.2s',
                    borderLeft: r.isRead ? 'none' : '3px solid #f59e0b'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 6px 0', color: r.isRead ? '#9ca3af' : '#f3f4f6', fontSize: '13px', fontWeight: r.isRead ? 400 : 600, lineHeight: 1.4 }}>
                        {r.reason}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                        {r.name && <span>👤 {r.name}</span>}
                        {r.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} /> {r.phone}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} />
                          {new Date(r.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {!r.isRead && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0, marginTop: '4px' }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
