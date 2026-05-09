import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const DATA_DIR = path.join(__dirname, '../../../data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// GET /api/v1/admin/bookings
router.get('/', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) {
      return res.json({ bookings: [] });
    }

    const bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
    res.json({ bookings });
  } catch (err) {
    console.error('[BookingRouter] list bookings error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

export { router as bookingRouter };
