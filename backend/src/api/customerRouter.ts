import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/v1/admin/customers
router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        bookings: true
      }
    });
    res.json({ customers });
  } catch (err) {
    console.error('[CustomerRouter] list customers error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

export { router as customerRouter };
