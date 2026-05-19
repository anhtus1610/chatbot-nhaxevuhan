import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Users, RefreshCw, AlertCircle, Search, Bus, Clock, Trash2 } from 'lucide-react'
import { listBookings, updateBookingStatus, deleteBooking, type BookingData } from '../services/api'
import CskhNotification from '../components/CskhNotification'

export default function BookingManager() {
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)


  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await listBookings()
      setBookings(data)
    } catch {
      setErrorMsg('Không thể tải danh sách đặt xe. Hãy kiểm tra kết nối với backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
    
    // Auto refresh every 5 seconds
    const interval = setInterval(() => {
      // Fetch without setting loading state to avoid flickering
      listBookings()
        .then(data => setBookings(data))
        .catch(err => console.error('Silent refresh failed:', err))
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchBookings])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateBookingStatus(id, newStatus)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b))
    } catch (err) {
      alert('Lỗi khi cập nhật trạng thái')
    }
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteBooking(deleteConfirmId)
      setBookings(prev => prev.filter(b => b.id !== deleteConfirmId))
    } catch (err) {
      alert('Lỗi khi xóa đơn đặt vé')
    } finally {
      setDeleteConfirmId(null)
    }
  }


  const filtered = bookings.filter(b => {
    const s = search.toLowerCase()
    return (
      (b.customer_name?.toLowerCase().includes(s)) ||
      (b.phone_number?.includes(s)) ||
      (b.pickup?.toLowerCase().includes(s)) ||
      (b.dropoff?.toLowerCase().includes(s))
    )
  })

  return (
    <div className="bm-layout">
      {/* Header */}
      <header className="bm-header">
        <div className="bm-title">
          <Users size={24} className="text-accent" />
          <h1>Quản lý đặt xe</h1>
          <span className="bm-count badge">{bookings.length} khách</span>
        </div>
        
        <div className="bm-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="bm-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT, điểm đi/đến..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary bm-refresh-btn" onClick={fetchBookings} disabled={loading} style={{ height: '38px' }}>
            <RefreshCw size={18} className={loading ? 'ke-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <CskhNotification />
        </div>
      </header>

      {/* Content */}
      <div className="bm-content">
        {errorMsg ? (
          <div className="ke-error-state">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        ) : loading && bookings.length === 0 ? (
          <div className="ke-loading-state">
            <RefreshCw size={24} className="ke-spin" />
            <span>Đang tải danh sách khách hàng...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ke-empty-state">
            <Users size={48} strokeWidth={1} />
            <h3>Chưa có dữ liệu</h3>
            <p>Không tìm thấy khách hàng nào khớp với tìm kiếm, hoặc chưa có ai đặt xe.</p>
          </div>
        ) : (
          <div className="bm-table-wrapper">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Thời gian đặt</th>
                  <th>Khách hàng</th>
                  <th>SĐT</th>
                  <th>Lộ trình</th>
                  <th>Khởi hành</th>
                  <th>Loại xe & Số vé</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td className="bm-col-time">
                      {new Date(b.createdAt).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="bm-col-name font-medium">{b.customer_name || '—'}</td>
                    <td className="bm-col-phone">{b.phone_number || '—'}</td>
                    <td className="bm-col-route">
                      <div className="bm-route">
                        <span className="bm-pickup">{b.pickup}</span>
                        <span className="bm-arrow">→</span>
                        <span className="bm-dropoff">{b.dropoff}</span>
                      </div>
                    </td>
                    <td className="bm-col-departure">
                      <div className="bm-icon-text">
                        <CalendarDays size={14} /> <span>{b.departure_date}</span>
                      </div>
                      <div className="bm-icon-text mt-1 text-accent">
                        <Clock size={14} /> <span>{b.departure_time}</span>
                      </div>
                    </td>
                    <td className="bm-col-vehicle">
                      <div className="bm-icon-text">
                        <Bus size={14} /> <span>{b.vehicle_type === 'giuong' ? 'Giường nằm' : b.vehicle_type === 'vip' ? 'Limousine' : 'Ghế ngồi'}</span>
                      </div>
                      <span className="bm-ticket-count">{b.ticket_count || 1} vé</span>
                    </td>
                    <td className="bm-col-status">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select 
                          value={b.status} 
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', outline: 'none' }}
                        >
                          <option value="incomplete" style={{ color: '#000' }}>Đang chờ</option>
                          <option value="complete" style={{ color: '#000' }}>Đã chốt</option>
                          <option value="cancelled" style={{ color: '#000' }}>Đã hủy</option>
                        </select>
                        <button 
                          className="btn icon-btn" 
                          onClick={() => handleDelete(b.id)}
                          title="Xóa vé"
                          style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '6px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#1f2937', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '400px', border: '1px solid #374151',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f3f4f6', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} color="#ef4444" />
              Xác nhận xóa vé
            </h3>
            <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: '1.5' }}>
              Bạn có chắc chắn muốn xóa đơn đặt vé này không? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => setDeleteConfirmId(null)}
                style={{ backgroundColor: '#374151', color: '#f3f4f6' }}
              >
                Hủy
              </button>
              <button 
                className="btn" 
                onClick={confirmDelete}
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                Xóa vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

