import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  MapPin, 
  Clock, 
  Bus,
  User,
  Bot
} from 'lucide-react'
import { sendMessageStream } from '../services/api'
import SuggestionCard from '../components/SuggestionCard'
import { useChat } from '../context/ChatContext'

export default function GeminiChat() {
  const { currentMessages: messages, addMessage, currentSessionId: sessionId, createNewChat } = useChat()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!sessionId) {
      createNewChat()
    }
  }, [sessionId, createNewChat])

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
      const reader = await sendMessageStream({
        sessionId: sessionId!,
        message: text.trim()
      })

      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let accumulatedText = ''
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
        }
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              if (data.type === 'text') {
                accumulatedText += data.content
                setStreamingContent(accumulatedText)
              } else if (data.type === 'done') {
                if (data.content) accumulatedText = data.content
              }
            } catch (e) {
              console.error('Error parsing SSE line:', e)
            }
          }
        }

        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim()
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                if (data.type === 'text') {
                  accumulatedText += data.content
                  setStreamingContent(accumulatedText)
                } else if (data.type === 'done') {
                  if (data.content) accumulatedText = data.content
                }
              } catch (e) {
                console.error('Error parsing SSE line in flush:', e)
              }
            }
          }
          break
        }
      }

      // After stream ends, save to context
      if (accumulatedText) {
        addMessage({
          role: 'assistant' as const,
          content: accumulatedText,
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        role: 'assistant' as const,
        content: 'Xin lỗi, tôi gặp sự cố khi kết nối. Bạn thử lại sau nhé!',
        timestamp: new Date()
      }
      addMessage(errorMessage)
    } finally {
      setLoading(false)
      setStreamingContent('')
    }
  }

  const suggestions = [
    { text: 'Xe limousine đi Hà Giang giá bao nhiêu?', icon: Bus },
    { text: 'Cho tôi xem lịch xe đi Xín Mần ngày mai', icon: Clock },
    { text: 'Tôi muốn đặt vé xe từ Mỹ Đình', icon: MapPin },
    { text: 'Nhà xe có nhận gửi hàng không?', icon: Sparkles },
  ]

  return (
    <div className="main-content">
      <div className="chat-container">
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
              {messages.map((msg, index) => (
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
                      <p className="whitespace-pre-wrap">
                        {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </p>
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
                      <p className="whitespace-pre-wrap">
                        {streamingContent.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </p>
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
  )
}
