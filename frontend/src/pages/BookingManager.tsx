import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Users, RefreshCw, AlertCircle, Search, Bus, CheckCircle2, Clock } from 'lucide-react'
import { listBookings, type BookingData } from '../services/api'

export default function BookingManager() {
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')

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
  }, [fetchBookings])

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
        
        <div className="bm-actions">
          <div className="bm-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT, điểm đi/đến..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary bm-refresh-btn" onClick={fetchBookings} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'ke-spin' : ''} />
            <span>Làm mới</span>
          </button>
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
                      {b.status === 'complete' ? (
                        <span className="badge badge-success"><CheckCircle2 size={14} /> Đã chốt</span>
                      ) : (
                        <span className="badge badge-warning"><AlertCircle size={14} /> Đang chờ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
