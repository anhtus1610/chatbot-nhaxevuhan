import React, { createContext, useContext, useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

interface ChatContextType {
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentMessages: Message[];
  createNewChat: () => void;
  selectSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(sessions));
  }, [sessions]);

  const createNewChat = () => {
    const newId = `session-${Date.now()}`;
    setCurrentSessionId(newId);
  };

  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const addMessage = (message: Message) => {
    setSessions(prev => {
      const existingSessionIndex = prev.findIndex(s => s.id === currentSessionId);
      
      if (existingSessionIndex >= 0) {
        // Update existing session
        const updatedSessions = [...prev];
        const session = { ...updatedSessions[existingSessionIndex] };
        session.messages = [...session.messages, message];
        session.updatedAt = new Date();
        
        // If it's the first user message, update title
        if (session.title === 'Cuộc trò chuyện mới' && message.role === 'user') {
          session.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
        }
        
        updatedSessions.splice(existingSessionIndex, 1);
        return [session, ...updatedSessions];
      } else {
        // Create new session if it doesn't exist (e.g. first message of new chat)
        const newSession: ChatSession = {
          id: currentSessionId || `session-${Date.now()}`,
          title: message.role === 'user' ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '') : 'Cuộc trò chuyện mới',
          messages: [message],
          updatedAt: new Date()
        };
        if (!currentSessionId) setCurrentSessionId(newSession.id);
        return [newSession, ...prev];
      }
    });
  };

  const currentMessages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  return (
    <ChatContext.Provider value={{ 
      sessions, 
      currentSessionId, 
      currentMessages, 
      createNewChat, 
      selectSession, 
      addMessage 
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
