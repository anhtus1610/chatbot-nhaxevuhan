import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  updatedAt: string
}

interface ChatState {
  sessions: ChatSession[]
  currentSessionId: string | null
  createNewChat: () => void
  selectSession: (sessionId: string) => void
  addMessage: (message: Omit<Message, 'timestamp'> & { timestamp?: string | Date }) => void
  clearSessions: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      
      createNewChat: () => {
        const newId = `session-${Date.now()}`
        set({ currentSessionId: newId })
      },
      
      selectSession: (sessionId) => {
        set({ currentSessionId: sessionId })
      },
      
      addMessage: (msg) => {
        const timestampStr = msg.timestamp
          ? typeof msg.timestamp === 'string'
            ? msg.timestamp
            : msg.timestamp.toISOString()
          : new Date().toISOString()

        const message: Message = {
          role: msg.role,
          content: msg.content,
          timestamp: timestampStr
        }

        const { sessions, currentSessionId } = get()
        const activeId = currentSessionId || `session-${Date.now()}`
        
        const existingSessionIndex = sessions.findIndex((s) => s.id === activeId)
        const nowStr = new Date().toISOString()

        if (existingSessionIndex >= 0) {
          const updatedSessions = [...sessions]
          const session = { ...updatedSessions[existingSessionIndex] }
          session.messages = [...session.messages, message]
          session.updatedAt = nowStr

          if (session.title === 'Cuộc trò chuyện mới' && message.role === 'user') {
            session.title =
              message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
          }

          updatedSessions.splice(existingSessionIndex, 1)
          set({
            sessions: [session, ...updatedSessions],
            currentSessionId: activeId
          })
        } else {
          const newSession: ChatSession = {
            id: activeId,
            title:
              message.role === 'user'
                ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                : 'Cuộc trò chuyện mới',
            messages: [message],
            updatedAt: nowStr
          }
          set({
            sessions: [newSession, ...sessions],
            currentSessionId: activeId
          })
        }
      },
      
      clearSessions: () => set({ sessions: [], currentSessionId: null })
    }),
    {
      name: 'vuhan_chat_store'
    }
  )
)
