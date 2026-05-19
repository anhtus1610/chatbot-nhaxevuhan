import { useState } from 'react'
import { getSchedule, ScheduleItem } from '../services/api'
import { useNavigate } from 'react-router-dom'

const LOCATIONS = [
  'Hà Nội', 'Mỹ Đình', 'Gia Lâm', 'Hà Giang', 'TP Hà Giang', 
  'Bắc Quang', 'Vị Xuyên', 'Quản Bạ', 'Yên Minh', 'Đồng Văn', 
  'Mèo Vạc', 'Xín Mần', 'Cốc Pài', 'Hoàng Su Phì', 'Tuyên Quang', 
  'Hàm Yên', 'Phú Thọ', 'Đoan Hùng', 'Vĩnh Phúc', 'Ngã tư Nội Bài'
]

export default function ScheduleViewer() {
  const [from, setFrom] = useState('Mỹ Đình')
  const [to, setTo] = useState('Hà Giang')
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await getSchedule({ from, to })
      setSchedules(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải lịch chạy')
    } finally {
      setLoading(false)
    }
  }

  // Sample schedule data (fallback)
  const sampleSchedules: ScheduleItem[] = [
    { time: '05:30', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
    { time: '06:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Xe khách', price: 200000 },
    { time: '07:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
    { time: '08:30', from: 'Mỹ Đình', to: 'Xín Mần', vehicleType: 'Limousine', price: 350000 },
    { time: '09:00', from: 'Mỹ Đình', to: 'Hoàng Su Phì', vehicleType: 'Limousine', price: 350000 },
    { time: '10:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Xe khách', price: 200000 },
    { time: '11:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
    { time: '13:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
    { time: '14:30', from: 'Mỹ Đình', to: 'Xín Mần', vehicleType: 'Limousine', price: 350000 },
    { time: '17:00', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
    { time: '20:30', from: 'Mỹ Đình', to: 'TP Hà Giang', vehicleType: 'Limousine', price: 280000 },
  ]

  const displaySchedules = schedules.length > 0 ? schedules : sampleSchedules

  return (
    <div style={{ padding: '32px', overflowY: 'auto', flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card">
        <h2>🕐 Lịch chạy xe</h2>
        <p className="subtitle">
          Xem lịch xe chạy hàng ngày từ Mỹ Đình
        </p>
      </div>

      <div className="card">
        <datalist id="locations-list">
          {LOCATIONS.map(loc => <option key={loc} value={loc} />)}
        </datalist>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Điểm đi</label>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              list="locations-list"
            />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Điểm đến</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              list="locations-list"
            />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'Đang tải...' : 'Tìm kiếm'}
          </button>
        </div>

        {error && (
          <div className="result-box error">
            <p>{error}</p>
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Giờ xuất bến</th>
              <th>Tuyến</th>
              <th>Loại xe</th>
              <th>Giá vé</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {displaySchedules.map((schedule, index) => (
              <tr key={index}>
                <td><strong>{schedule.time}</strong></td>
                <td>{schedule.from} → {schedule.to}</td>
                <td>
                  <span className={`badge ${schedule.vehicleType === 'Limousine' ? 'badge-success' : 'badge-warning'}`}>
                    {schedule.vehicleType}
                  </span>
                </td>
                <td>{schedule.price.toLocaleString('vi-VN')}đ</td>
                <td>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '4px 12px', fontSize: '14px' }}
                    onClick={() => navigate('/chat', { state: { initialMessage: `Tôi muốn đặt vé chuyến ${schedule.time} từ ${schedule.from} đi ${schedule.to} bằng ${schedule.vehicleType}` } })}
                  >
                    🎟️ Đặt vé
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>📞 Thông tin liên hệ</h3>
        <div style={{ marginTop: 12 }}>
          <p><strong>Hotline:</strong> 1900 xxxx</p>
          <p><strong>Bến xe Mỹ Đình:</strong> Số X, Phạm Hùng, Nam Từ Liêm, Hà Nội</p>
          <p><strong>Văn phòng Hà Giang:</strong> Số Y, TP Hà Giang</p>
        </div>
      </div>
    </div>
  )
}
