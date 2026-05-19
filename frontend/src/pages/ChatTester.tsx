import { useState, useRef, useEffect } from 'react'
import { sendMessage, ChatResponse } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  intent?: string
  extractedData?: Record<string, unknown>
}

export default function ChatTester() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Dạ em chào anh/chị ạ! Em là trợ lý ảo của Nhà xe Vũ Hán. Anh/chị cần em hỗ trợ gì ạ?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `test-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response: ChatResponse = await sendMessage({
        sessionId,
        message: input.trim()
      })

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
        intent: response.intent,
        extractedData: response.extractedData
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: '❌ Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickMessages = [
    'Tôi muốn đặt vé xe đi Hà Giang',
    'Xe limousine giá bao nhiêu?',
    'Cho tôi xem lịch xe ngày mai',
    'Xe đi Xín Mần mấy giờ có?',
    'Tôi muốn gửi hàng',
    'Cho tôi gặp nhân viên'
  ]

  return (
    <div>
      <div className="card">
        <h2>💬 Test Chatbot</h2>
        <p style={{ color: '#666', marginTop: 8 }}>
          Thử nghiệm chatbot trực tiếp - Session: {sessionId}
        </p>
      </div>

      <div className="grid-2">
        <div className="card" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          {/* Messages area */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            marginBottom: 16,
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: 8
          }}>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 16,
                  textAlign: msg.role === 'user' ? 'right' : 'left'
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: 16,
                    background: msg.role === 'user' ? '#1a73e8' : 'white',
                    color: msg.role === 'user' ? 'white' : '#333',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.intent && (
                    <p style={{ 
                      margin: '8px 0 0', 
                      fontSize: 11, 
                      opacity: 0.7 
                    }}>
                      Intent: {msg.intent}
                    </p>
                  )}
                </div>
                <p style={{ 
                  fontSize: 11, 
                  color: '#999', 
                  marginTop: 4 
                }}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ))}
            {loading && (
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '12px 16px',
                  borderRadius: 16,
                  background: 'white'
                }}>
                  <span>Đang trả lời...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Nhập tin nhắn..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 24,
                fontSize: 14
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn btn-primary"
              style={{ borderRadius: 24, padding: '12px 24px' }}
            >
              Gửi
            </button>
          </div>
        </div>

        <div className="card">
          <h3>⚡ Tin nhắn nhanh</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Click để gửi nhanh
          </p>

          {quickMessages.map((msg, index) => (
            <button
              key={index}
              onClick={() => {
                setInput(msg)
                setTimeout(() => {
                  handleSend()
                }, 100)
              }}
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                marginBottom: '8px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                textAlign: 'left',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {msg}
            </button>
          ))}

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

          <h4>📊 Debug Info</h4>
          <div style={{ 
            marginTop: 12, 
            padding: 12, 
            background: '#f8f9fa', 
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace'
          }}>
            <p>Session: {sessionId}</p>
            <p>Messages: {messages.length}</p>
            <p>Status: {loading ? '⏳ Loading...' : '✅ Ready'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
