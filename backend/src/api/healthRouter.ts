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
  const safeUrl = dbUrl ? dbUrl.replace(/:([^@]+)@/, ':***@') : 'NOT SET';

  if (!dbUrl) {
    return res.status(500).json({ status: 'error', error: 'DATABASE_URL chưa được set', host: safeUrl });
  }

  try {
    const prisma = (await import('../utils/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'connected', host: safeUrl });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      host: safeUrl,
      error: err?.message || String(err)
    });
  }
});

// GET /api/health/validate-test — Debug endpoint để test validatePickupLocation logic
router.get('/validate-test', (req: Request, res: Response) => {
  const pickupVal = String(req.query.pickup || 'Hà Nội');
  const userMsg = String(req.query.msg || 'giá vé hà nội đồng văn');
  
  const normalize = (s: string) => s.normalize('NFC').toLowerCase().trim();
  const locLower = normalize(pickupVal);
  const normalizedMsg = normalize(userMsg);
  
  const hanoiKeywords = ['hà nội', 'ha noi', 'hanoi', 'mỹ đình', 'my dinh'];
  const normalizedKws = hanoiKeywords.map(k => normalize(k));
  
  const directMatch = normalizedMsg.includes(locLower);
  const kwMatch = normalizedKws.some(kw => normalizedMsg.includes(kw));
  
  res.json({
    input: { pickupVal, userMsg },
    normalized: { locLower, normalizedMsg: normalizedMsg.substring(0, 60) },
    hexPickup: Buffer.from(locLower).toString('hex'),
    hexMsgSlice: Buffer.from(normalizedMsg.substring(0, 10)).toString('hex'),
    directMatch,
    kwMatch,
    normalizedKws
  });
});

export { router as healthRouter };
