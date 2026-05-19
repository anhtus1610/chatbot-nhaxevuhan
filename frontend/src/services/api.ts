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

export async function sendMessageStream(data: ChatRequest): Promise<ReadableStreamDefaultReader<Uint8Array> | undefined> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  return response.body?.getReader();
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await api.get('/health')
  return response.data
}


// ─── Knowledge Editor ───────────────────────────────────────────────────────

export interface KnowledgeDocMeta {
  path: string
  name: string
  folder: string
  size: number
  updatedAt: string
}

export interface KnowledgeDocsResponse {
  operator_id: string
  operator_name: string
  total_docs: number
  docs: KnowledgeDocMeta[]
}

export interface KnowledgeDocContent {
  operator_id: string
  path: string
  name: string
  content: string
  size: number
  updatedAt: string
}

export async function listKnowledgeDocs(operatorId = 'vu_han'): Promise<KnowledgeDocsResponse> {
  const response = await api.get(`/v1/operators/${operatorId}/knowledge/docs`)
  return response.data
}

export async function getKnowledgeDoc(operatorId = 'vu_han', filePath: string): Promise<KnowledgeDocContent> {
  const response = await api.get(`/v1/operators/${operatorId}/knowledge/doc`, {
    params: { path: filePath },
  })
  return response.data
}

export async function updateKnowledgeDoc(
  operatorId = 'vu_han',
  filePath: string,
  content: string,
  commitMessage?: string
): Promise<{ success: boolean; updatedAt: string }> {
  const response = await api.put(`/v1/operators/${operatorId}/knowledge/doc`, {
    path: filePath,
    content,
    commit_message: commitMessage,
  })
  return response.data
}

// ─── Booking Management ──────────────────────────────────────────────────────

export interface BookingData {
  id: string
  createdAt: string
  customer_name?: string
  phone_number?: string
  pickup: string
  dropoff: string
  departure_date?: string
  departure_time?: string
  vehicle_type?: string
  ticket_count?: number
  status: string
}

export async function listBookings(): Promise<BookingData[]> {
  const response = await api.get(`/v1/admin/bookings`)
  return response.data.bookings || []
}

export async function updateBookingStatus(id: string, status: string): Promise<BookingData> {
  const response = await api.patch(`/v1/admin/bookings/${id}/status`, { status })
  return response.data.booking
}

export async function deleteBooking(id: string): Promise<boolean> {
  const response = await api.delete(`/v1/admin/bookings/${id}`)
  return response.data.success
}

export default api

