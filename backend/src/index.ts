/**
 * Chatbot Nhà xe Vũ Hán - Backend Entry Point
 * 
 * Dự án: Nghiên cứu và xây dựng chatbot hỗ trợ tư vấn và đặt vé
 * dựa trên mô hình ngôn ngữ lớn (LLM) và function calling
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { chatRouter } from './api/chatRouter';
import { routeRouter } from './api/routeRouter';
import { healthRouter } from './api/healthRouter';
import { knowledgeRouter } from './api/knowledgeRouter';
import { bookingRouter } from './api/bookingRouter';
import { customerRouter } from './api/customerRouter';
import { cskhRouter } from './api/cskhRouter';

// Load env file phù hợp với môi trường
// Trên Vercel: env vars đã được set qua Dashboard, dotenv chỉ dùng khi local
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.production') });
} else {
  dotenv.config();
}

// Kiểm tra các env var quan trọng khi khởi động
const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`⚠️  Thiếu environment variables: ${missingVars.join(', ')}`);
  console.error('   → Vào Vercel Dashboard → Settings → Environment Variables để thêm');
}

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
app.use('/api/v1/admin/customers', customerRouter); // Admin Customer API
app.use('/api/v1/admin/cskh', cskhRouter);          // Admin CSKH Notifications
app.use('/api/route', routeRouter);              // Frontend dùng path này
app.use('/api/health', healthRouter);
app.get('/healthz', (req, res) => res.send('ok'));

// Chỉ gọi app.listen() khi chạy local (không phải Vercel serverless)
// Vercel sẽ tự quản lý HTTP server và dùng `export default app`
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚌 Chatbot Nhà xe Vũ Hán Backend đang chạy tại port ${PORT}`);
    console.log(`📚 Knowledge root: ${process.env.KNOWLEDGE_ROOT || './knowledge'}`);
  });
}

export default app;
