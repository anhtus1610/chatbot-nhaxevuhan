import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, AlertCircle, Search, Phone } from 'lucide-react'
import api from '../services/api'
import CskhNotification from '../components/CskhNotification'


interface CustomerData {
  id: string;
  name: string;
  phone: string;
  total_tickets: number;
  updatedAt: string;
}

export default function CustomerManager() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const response = await api.get('/v1/admin/customers')
      setCustomers(response.data.customers || [])
    } catch {
      setErrorMsg('Không thể tải danh sách khách hàng. Hãy kiểm tra kết nối với backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()

    // Auto refresh every 5 seconds
    const interval = setInterval(() => {
      api.get('/v1/admin/customers')
        .then(response => setCustomers(response.data.customers || []))
        .catch(err => console.error('Silent customer refresh failed:', err))
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchCustomers])

  const filtered = customers.filter(c => {
    const s = search.toLowerCase()
    return (
      (c.name?.toLowerCase().includes(s)) ||
      (c.phone?.includes(s))
    )
  })

  return (
    <div className="bm-layout">
      <header className="bm-header">
        <div className="bm-title">
          <Users size={24} className="text-accent" />
          <h1>Quản lý khách hàng</h1>
          <span className="bm-count badge">{customers.length} khách</span>
        </div>
        
        <div className="bm-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="bm-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary bm-refresh-btn" onClick={fetchCustomers} disabled={loading} style={{ height: '38px' }}>
            <RefreshCw size={18} className={loading ? 'ke-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <CskhNotification />
        </div>
      </header>

      <div className="bm-content">
        {errorMsg ? (
          <div className="ke-error-state">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        ) : loading && customers.length === 0 ? (
          <div className="ke-loading-state">
            <RefreshCw size={24} className="ke-spin" />
            <span>Đang tải danh sách khách hàng...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ke-empty-state">
            <Users size={48} strokeWidth={1} />
            <h3>Chưa có dữ liệu</h3>
            <p>Không tìm thấy khách hàng nào khớp với tìm kiếm, hoặc chưa có khách hàng nào.</p>
          </div>
        ) : (
          <div className="bm-table-wrapper">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Tên khách hàng</th>
                  <th>Số điện thoại</th>
                  <th>Tổng số vé đã đặt</th>
                  <th>Lần giao dịch cuối</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="bm-col-name font-medium">{c.name}</td>
                    <td className="bm-col-phone">
                      <div className="bm-icon-text">
                        <Phone size={14} /> <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="bm-col-ticket">
                      <span className="bm-ticket-count">{c.total_tickets} vé</span>
                    </td>
                    <td className="bm-col-time">
                      {new Date(c.updatedAt).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
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
