import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/v1/admin/cskh — Lấy danh sách yêu cầu CSKH
router.get('/', async (req: Request, res: Response) => {
  try {
    const requests = await prisma.cskhRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const unreadCount = await prisma.cskhRequest.count({ where: { isRead: false } });
    res.json({ requests, unreadCount });
  } catch (err) {
    console.error('[CskhRouter] list error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

// PATCH /api/v1/admin/cskh/:id/read — Đánh dấu đã đọc
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.cskhRequest.update({ where: { id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('[CskhRouter] mark read error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

// PATCH /api/v1/admin/cskh/read-all — Đánh dấu tất cả đã đọc
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    await prisma.cskhRequest.updateMany({ where: { isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('[CskhRouter] read-all error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

export { router as cskhRouter };
