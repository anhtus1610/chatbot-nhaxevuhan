/**
 * Chatbot Nhà xe Vũ Hán - Backend Entry Point
 * 
 * Dự án: Nghiên cứu và xây dựng chatbot hỗ trợ tư vấn và đặt vé
 * dựa trên mô hình ngôn ngữ lớn (LLM) và function calling
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './api/chatRouter';
import { routeRouter } from './api/routeRouter';
import { healthRouter } from './api/healthRouter';
import { knowledgeRouter } from './api/knowledgeRouter';
import { bookingRouter } from './api/bookingRouter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 14556;

// Middleware
app.use(cors({
  origin: '*', // Tạm thời để * để test với Vercel headers
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/v1/operators', routeRouter);
app.use('/api/v1/operators', knowledgeRouter);   // Knowledge Editor API
app.use('/api/v1/admin/bookings', bookingRouter); // Admin Booking API
app.use('/api/route', routeRouter);              // Frontend dùng path này
app.use('/api/health', healthRouter);
app.get('/healthz', (req, res) => res.send('ok'));

// Start server
app.listen(PORT, () => {
  console.log(`🚌 Chatbot Nhà xe Vũ Hán Backend đang chạy tại port ${PORT}`);
  console.log(`📚 Knowledge root: ${process.env.KNOWLEDGE_ROOT || './knowledge'}`);
});

export default app;
