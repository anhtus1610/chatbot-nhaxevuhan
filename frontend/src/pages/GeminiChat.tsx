import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { 
  Send, 
  Sparkles, 
  MapPin, 
  Clock, 
  Bus,
  User,
  Bot,
  Settings,
  X,
  Plus,
  Trash2
} from 'lucide-react'
import { sendMessage } from '../services/api'
import SuggestionCard from '../components/SuggestionCard'
import { useChatStore, ChatSession, Message } from '../stores/chatStore'
import { useUserStore, BookingHistoryItem } from '../stores/userStore'
import { useLocation } from 'react-router-dom'

export default function GeminiChat() {
  const { sessions, currentSessionId: sessionId, createNewChat, addMessage } = useChatStore()
  const messages = sessions.find((s: ChatSession) => s.id === sessionId)?.messages || []
  
  const userState = useUserStore()
  
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()
  const hasSentInitialRef = useRef(false)

  // Simulation UI states
  const [showSimPanel, setShowSimPanel] = useState(false)
  const [simName, setSimName] = useState(userState.name)
  const [simPhone, setSimPhone] = useState(userState.phone)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')

  // Sync simulation local inputs with userState when userState updates
  useEffect(() => {
    setSimName(userState.name)
    setSimPhone(userState.phone)
  }, [userState.name, userState.phone])

  useEffect(() => {
    if (!sessionId) {
      createNewChat()
    }
  }, [sessionId, createNewChat])

  useEffect(() => {
    setInput('')
    setLoading(false)
    setStreamingContent('')
    hasSentInitialRef.current = false
  }, [sessionId])

  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null
    if (state?.initialMessage && !hasSentInitialRef.current && sessionId) {
      hasSentInitialRef.current = true
      handleSend(state.initialMessage)
      window.history.replaceState({}, document.title)
    }
  }, [location.state, sessionId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return

    const userMessage = {
      role: 'user' as const,
      content: text.trim(),
      timestamp: new Date()
    }

    addMessage(userMessage)
    setInput('')
    setLoading(true)

    try {
      const response = await sendMessage({
        sessionId: sessionId!,
        message: text.trim(),
        user_profile: {
          name: userState.name,
          phone: userState.phone,
          bookingHistory: userState.bookingHistory
        }
      })

      addMessage({
        role: 'assistant' as const,
        content: response.reply,
        timestamp: new Date()
      })

      // Automate saving of user profile and booking history from chatbot responses to Zustand localstorage
      if (response.booking_data) {
        const bd = response.booking_data
        const profileUpdates: any = {}
        if (bd.customer_name) profileUpdates.name = bd.customer_name
        if (bd.phone_number) profileUpdates.phone = bd.phone_number
        if (bd.email) profileUpdates.email = bd.email

        if (Object.keys(profileUpdates).length > 0) {
          userState.setUserProfile(profileUpdates)
        }

        if (bd.status === 'complete') {
          // Check if already in history to avoid duplication
          const alreadyExists = userState.bookingHistory.some((b: BookingHistoryItem) => 
            b.from === bd.pickup && 
            b.to === bd.dropoff && 
            b.date === bd.departure_date && 
            b.time === bd.departure_time
          )
          
          if (!alreadyExists) {
            userState.addBooking({
              from: bd.pickup,
              to: bd.dropoff,
              date: bd.departure_date,
              time: bd.departure_time,
              vehicleType: bd.vehicle_type
            })
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error)
      addMessage({
        role: 'assistant' as const,
        content: 'Xin lỗi, tôi gặp sự cố khi kết nối. Bạn thử lại sau nhé!',
        timestamp: new Date()
      })
    } finally {
      setLoading(false)
      setStreamingContent('')
    }
  }

  const handleAddSimBooking = () => {
    if (newFrom.trim() && newTo.trim()) {
      userState.addBooking({
        from: newFrom.trim(),
        to: newTo.trim()
      })
      setNewFrom('')
      setNewTo('')
    }
  }

  const handleSaveSimProfile = () => {
    userState.setUserProfile({ 
      name: simName,
      phone: simPhone
    })
  }

  const suggestions = [
    { text: 'Xe limousine đi Hà Giang giá bao nhiêu?', icon: Bus },
    { text: 'Cho tôi xem lịch xe đi Xín Mần ngày mai', icon: Clock },
    { text: 'Tôi muốn đặt vé xe từ Mỹ Đình', icon: MapPin },
    { text: 'Nhà xe có nhận gửi hàng không?', icon: Sparkles },
  ]

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        
        {/* Header toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>Vũ Hán Assistant</span>
            {userState.name && (
              <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#aaa' }}>
                Khách: {userState.name} ({userState.phone})
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowSimPanel(!showSimPanel)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Settings size={16} />
            <span>Thông tin lưu trữ</span>
          </button>
        </div>

        <div className="chat-container" style={{ flex: 1, overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div 
                key="greeting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="greeting-section"
              >
                <h1 className="greeting-text">Chào bạn, tôi là Vũ Hán Assistant</h1>
                <p className="text-[#c4c7c5] text-lg mb-8">Hôm nay tôi có thể giúp gì cho chuyến đi của bạn?</p>
                
                <div className="suggestion-grid">
                  {suggestions.map((s, i) => (
                    <SuggestionCard 
                      key={i} 
                      text={s.text} 
                      icon={s.icon} 
                      onClick={() => handleSend(s.text)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <div key="messages" className="message-list">
                {messages.map((msg: Message, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="message-item"
                  >
                    <div className="message-wrapper">
                      <div className={`avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={msg.role === 'user' ? 'message-bubble user-message' : 'message-bubble assistant-message'}>
                        {msg.role === 'user' ? (
                          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{children}</p>,
                              strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                              ul: ({ children }) => <ul style={{ margin: '6px 0', padding: 0, listStyle: 'none' }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ol>,
                              li: ({ children }) => <li style={{ lineHeight: 1.65, marginBottom: '4px', paddingLeft: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span style={{ flexShrink: 0, marginTop: '2px' }}>•</span><span>{children}</span></li>,
                              h3: ({ children }) => <h3 style={{ fontWeight: 600, fontSize: '0.9em', margin: '10px 0 4px', opacity: 0.85 }}>{children}</h3>,
                              h2: ({ children }) => <h2 style={{ fontWeight: 700, fontSize: '1em', margin: '10px 0 4px' }}>{children}</h2>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {streamingContent && (
                  <div className="message-item">
                    <div className="message-wrapper">
                      <div className="avatar bot">
                        <Bot size={16} />
                      </div>
                      <div className="message-bubble assistant-message">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.65 }}>{children}</p>,
                            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                            ul: ({ children }) => <ul style={{ margin: '6px 0', padding: 0, listStyle: 'none' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ lineHeight: 1.65, marginBottom: '4px', paddingLeft: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span style={{ flexShrink: 0, marginTop: '2px' }}>•</span><span>{children}</span></li>,
                            h3: ({ children }) => <h3 style={{ fontWeight: 600, fontSize: '0.9em', margin: '10px 0 4px', opacity: 0.85 }}>{children}</h3>,
                            h2: ({ children }) => <h2 style={{ fontWeight: 700, fontSize: '1em', margin: '10px 0 4px' }}>{children}</h2>,
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
                {loading && !streamingContent && (
                  <div className="message-item">
                    <div className="message-wrapper">
                      <div className="avatar bot">
                        <Bot size={16} />
                      </div>
                      <div className="loading-dots">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="loading-dot" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                          className="loading-dot" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }} 
                          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                          className="loading-dot" 
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Nhập câu hỏi của bạn tại đây..."
              className="chat-input"
            />
            <div className="input-actions">
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`icon-btn ${
                  input.trim() && !loading ? 'active' : ''
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <p className="disclaimer-text">
            Vũ Hán Assistant có thể nhầm lẫn. Hãy kiểm tra lại các thông tin quan trọng.
          </p>
        </div>
      </div>

      {/* Simulator sidebar panel */}
      {showSimPanel && (
        <div style={{ width: '320px', borderLeft: '1px solid rgba(255,255,255,0.08)', background: '#1c1c1e', color: '#fff', display: 'flex', flexDirection: 'column', height: '100%', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Thông tin Lưu trữ (Zustand)</h3>
            <button onClick={() => setShowSimPanel(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Profile Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '4px' }}>Tên khách hàng</label>
                <input 
                  type="text" 
                  value={simName} 
                  onChange={(e) => setSimName(e.target.value)}
                  style={{ width: '100%', background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '4px' }}>Số điện thoại</label>
                <input 
                  type="text" 
                  value={simPhone} 
                  onChange={(e) => setSimPhone(e.target.value)}
                  style={{ width: '100%', background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>


              <button 
                onClick={handleSaveSimProfile}
                style={{ background: '#0a84ff', border: 'none', color: '#fff', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '0.9rem', width: '100%', fontWeight: 500 }}
              >
                Cập nhật Profile
              </button>
            </div>

            {/* Booking history */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '6px' }}>Lịch sử đặt chuyến</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {userState.bookingHistory.map((booking: BookingHistoryItem, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2c2c2e', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <span>{booking.from} ➔ {booking.to}</span>
                    <button 
                      onClick={() => {
                        const nextHistory = [...userState.bookingHistory]
                        nextHistory.splice(idx, 1)
                        userState.setBookingHistory(nextHistory)
                      }}
                      style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add booking */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Thêm chuyến xe đã đặt</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Đi (VD: TQ)" 
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    style={{ flex: 1, background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.8rem' }}
                  />
                  <input 
                    type="text" 
                    placeholder="Đến (VD: HG)" 
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    style={{ flex: 1, background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.8rem' }}
                  />
                </div>
                <button 
                  onClick={handleAddSimBooking}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#30d158', border: 'none', color: '#fff', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
                >
                  <Plus size={14} />
                  <span>Thêm chuyến</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
