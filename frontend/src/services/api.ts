import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000
})

export interface RouteCheckRequest {
  from: string
  to: string
  vehicleType?: 'limousine' | 'xe_khach'
}

export interface RouteCheckResponse {
  valid: boolean
  from: string
  to: string
  normalizedFrom?: string
  normalizedTo?: string
  price?: number
  vehicleType?: string
  message?: string
  alternatives?: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  sessionId: string
  message: string
}

export interface ChatResponse {
  reply: string
  sessionId: string
  intent?: string
  extractedData?: Record<string, unknown>
  handoff?: boolean
}

export interface ScheduleRequest {
  from: string
  to: string
  date?: string
}

export interface ScheduleItem {
  time: string
  from: string
  to: string
  vehicleType: string
  price: number
  availableSeats?: number
}

export async function checkRoute(data: RouteCheckRequest): Promise<RouteCheckResponse> {
  const response = await api.post('/route/check', data)
  return response.data
}

export async function getSchedule(data: ScheduleRequest): Promise<ScheduleItem[]> {
  const response = await api.get('/route/schedule', { params: data })
  return response.data.schedules || []
}

export async function sendMessage(data: ChatRequest): Promise<ChatResponse> {
  const response = await api.post('/chat', data)
  return response.data
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await api.get('/health')
  return response.data
}

export default api
