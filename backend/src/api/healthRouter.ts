/**
 * Health Check API Router
 */

import { Router, Request, Response } from 'express';
import { knowledgeService } from '../services/KnowledgeService';

const router = Router();

// GET /api/health
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GET /api/health/redis
router.get('/redis', async (req: Request, res: Response) => {
  try {
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    res.json({
      status: redisEnabled ? 'connected' : 'disabled',
      fallback: !redisEnabled ? 'memory' : undefined
    });
  } catch (error) {
    res.json({ status: 'error', fallback: 'memory' });
  }
});

// GET /api/health/openai
router.get('/openai', (req: Request, res: Response) => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.json({
    status: apiKey ? 'configured' : 'missing',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  });
});

// GET /api/health/knowledge - Thống kê Knowledge Store (Markdown)
router.get('/knowledge', async (req: Request, res: Response) => {
  await knowledgeService.init();
  const stats = knowledgeService.getStats();
  res.json({
    status: 'ok',
    knowledge_store: 'Markdown (operators/vu_han/)',
    stats
  });
});

// GET /api/health/db — Kiểm tra kết nối PostgreSQL (Prisma)
router.get('/db', async (req: Request, res: Response) => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return res.status(500).json({
      status: 'error',
      error: 'DATABASE_URL chưa được set trong Vercel Environment Variables',
      hint: 'Vào Vercel Dashboard → Project Settings → Environment Variables'
    });
  }

  // Che giấu password, chỉ hiện host
  const safeUrl = dbUrl.replace(/:([^@]+)@/, ':***@');

  try {
    const prisma = (await import('../utils/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'connected',
      host: safeUrl,
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      host: safeUrl,
      error: err?.message || String(err),
      hint: 'Kiểm tra DATABASE_URL có đúng format và password được URL-encode chưa'
    });
  }
});

export { router as healthRouter };
