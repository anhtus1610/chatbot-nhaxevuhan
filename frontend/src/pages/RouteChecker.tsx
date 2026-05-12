import { useState } from 'react'
import { checkRoute, RouteCheckResponse } from '../services/api'
import { useNavigate } from 'react-router-dom'

const LOCATIONS = [
  'Hà Nội', 'Mỹ Đình', 'Gia Lâm', 'Hà Giang', 'TP Hà Giang', 
  'Bắc Quang', 'Vị Xuyên', 'Quản Bạ', 'Yên Minh', 'Đồng Văn', 
  'Mèo Vạc', 'Xín Mần', 'Cốc Pài', 'Hoàng Su Phì', 'Tuyên Quang', 
  'Hàm Yên', 'Phú Thọ', 'Đoan Hùng', 'Vĩnh Phúc', 'Ngã tư Nội Bài'
]

export default function RouteChecker() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vehicleType, setVehicleType] = useState<'limousine' | 'xe_khach'>('limousine')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RouteCheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await checkRoute({ from, to, vehicleType })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const quickRoutes = [
    { from: 'Hà Nội', to: 'Hà Giang' },
    { from: 'Mỹ Đình', to: 'Xín Mần' },
    { from: 'Hà Nội', to: 'Hoàng Su Phì' },
    { from: 'Mỹ Đình', to: 'Cốc Pài' },
    { from: 'Hà Nội', to: 'TP Lào Cai' },
  ]

  return (
    <div style={{ padding: '32px', overflowY: 'auto', flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card">
        <h2>🗺️ Kiểm tra tuyến đường</h2>
        <p className="subtitle">
          Kiểm tra tính hợp lệ của tuyến đường và giá vé
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <datalist id="locations-list">
            {LOCATIONS.map(loc => <option key={loc} value={loc} />)}
          </datalist>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Điểm đi</label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="VD: Hà Nội, Mỹ Đình..."
                list="locations-list"
                required
              />
            </div>

            <div className="form-group">
              <label>Điểm đến</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="VD: Hà Giang, Xín Mần..."
                list="locations-list"
                required
              />
            </div>

            <div className="form-group">
              <label>Loại xe</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as 'limousine' | 'xe_khach')}
              >
                <option value="limousine">Xe Limousine</option>
                <option value="xe_khach">Xe khách thường</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang kiểm tra...' : 'Kiểm tra tuyến'}
            </button>
          </form>

          {result && (
            <div className={`result-box ${result.valid ? 'success' : 'error'}`}>
              <h4>{result.valid ? '✅ Tuyến hợp lệ' : '❌ Tuyến không hợp lệ'}</h4>
              <p><strong>Điểm đi:</strong> {result.from}{result.normalizedFrom && result.normalizedFrom !== result.from ? ` → ${result.normalizedFrom}` : ''}</p>
              <p><strong>Điểm đến:</strong> {result.to}{result.normalizedTo && result.normalizedTo !== result.to ? ` → ${result.normalizedTo}` : ''}</p>
              {result.price && <p><strong>Giá vé:</strong> {result.price.toLocaleString()}đ</p>}
              {result.message && <p><strong>Ghi chú:</strong> {result.message}</p>}
              {result.alternatives && result.alternatives.length > 0 && (
                <p><strong>Gợi ý:</strong> {result.alternatives.join(', ')}</p>
              )}
              {result.valid && (
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/chat', { state: { initialMessage: `Tôi muốn đặt vé từ ${result.normalizedFrom || result.from} đi ${result.normalizedTo || result.to} bằng ${vehicleType === 'limousine' ? 'xe limousine' : 'xe khách'}` } })}
                  >
                    🎟️ Đặt vé ngay
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="result-box error">
              <h4>❌ Lỗi</h4>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3>📍 Tuyến nhanh</h3>
          <p className="subtitle">Click để test nhanh</p>
          
          {quickRoutes.map((route, index) => (
            <button
              key={index}
              onClick={() => {
                setFrom(route.from)
                setTo(route.to)
              }}
              className="quick-route-btn"
            >
              {route.from} → {route.to}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
