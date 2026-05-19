/**
 * Chat API Router
 */

import { Router, Request, Response } from 'express';
import { VuHanChatAgent } from '../agents/VuHanChatAgent';

const router = Router();

// Lưu trữ sessions (trong production nên dùng Redis)
const sessions: Map<string, VuHanChatAgent> = new Map();

// POST /api/chat
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, session_id, operator_id = 'vu_han' } = req.body;

    if (!message) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "message"'
        }
      });
    }

    // Lấy hoặc tạo session
    const sessionId = session_id || req.body.sessionId;
    
    let agent = sessions.get(sessionId);
    if (!agent) {
      agent = new VuHanChatAgent(operator_id);
      if (sessionId) {
        sessions.set(sessionId, agent);
      }
    }

    // Xử lý tin nhắn
    const response = await agent.chat(message);

    res.json({
      success: true,
      session_id: sessionId || 'anonymous',
      reply: response.message,
      intent: response.intent,
      booking_data: response.bookingData,
      needs_escalation: response.needsEscalation,
      tool_calls: response.toolCalls?.map(tc => ({
        tool: tc.toolName,
        result: tc.result
      }))
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống, vui lòng thử lại sau'
      }
    });
  }
});

// POST /api/chat/stream
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { message, session_id, operator_id = 'vu_han' } = req.body;

    if (!message) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "message"'
        }
      });
    }

    const sessionId = session_id || req.body.sessionId;
    
    let agent = sessions.get(sessionId);
    if (!agent) {
      agent = new VuHanChatAgent(operator_id);
      if (sessionId) {
        sessions.set(sessionId, agent);
      }
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from stream');
    });

    const stream = agent.chatStream(message);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'text', content: 'Lỗi hệ thống' })}\n\n`);
    res.end();
  }
});

// DELETE /api/chat/:session_id - Reset session
router.delete('/:session_id', (req: Request, res: Response) => {
  const { session_id } = req.params;
  
  if (sessions.has(session_id)) {
    sessions.get(session_id)?.resetConversation();
    res.json({ success: true, message: 'Session reset' });
  } else if (req.params.session_id && sessions.has(req.params.session_id)) {
    // support both param names and actual sessions
    sessions.get(req.params.session_id)?.resetConversation();
    res.json({ success: true, message: 'Session reset' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

export { router as chatRouter };
