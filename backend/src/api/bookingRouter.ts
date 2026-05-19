import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/v1/admin/bookings
router.get('/', async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ bookings });
  } catch (err: any) {
    console.error('[BookingRouter] list bookings error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: err.message || 'Lỗi hệ thống', stack: err.stack } });
  }
});

// PATCH /api/v1/admin/bookings/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'Thiếu trường status' } });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status }
    });
    res.json({ booking: updated });
  } catch (err: any) {
    console.error('[BookingRouter] update status error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: err.message || 'Lỗi hệ thống', stack: err.stack } });
  }
});

// DELETE /api/v1/admin/bookings/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.booking.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[BookingRouter] delete error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: err.message || 'Lỗi hệ thống', stack: err.stack } });
  }
});

export { router as bookingRouter };
