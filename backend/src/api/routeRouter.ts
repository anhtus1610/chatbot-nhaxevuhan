/**
 * Route Validation API Router
 */

import { Router, Request, Response } from 'express';
import { checkRouteAndPrice } from '../tools/checkRouteAndPrice';
import { getDepartureTimes } from '../tools/getDepartureTimes';
import { getETA } from '../tools/getETA';

const router = Router();

// POST /api/v1/operators/:operator_id/route/validate
router.post('/:operator_id/route/validate', async (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const { vehicle = 'bus', pickup, dropoff, query, include_debug = false } = req.body;

    if (!pickup || !dropoff) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "pickup" hoặc "dropoff"'
        }
      });
    }

    const result = await checkRouteAndPrice(operator_id, pickup, dropoff, vehicle);
    
    res.json(result);

  } catch (error) {
    console.error('Route validate error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống'
      }
    });
  }
});

// POST /api/v1/operators/:operator_id/route/time
router.post('/:operator_id/route/time', async (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const { from, to, route_name, profile, vias, include_debug = false } = req.body;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "from" hoặc "to"'
        }
      });
    }

    // Sử dụng getETA để tính thời gian
    const result = await getETA(operator_id, '00:00', to, from, to);
    
    res.json({
      operator_id,
      from,
      to,
      duration: {
        minutes: result.offset_minutes,
        text: `khoảng ${Math.floor(result.offset_minutes / 60)} tiếng ${result.offset_minutes % 60} phút`
      },
      note: result.note
    });

  } catch (error) {
    console.error('Route time error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống'
      }
    });
  }
});

// GET /api/v1/operators/:operator_id/schedule
router.get('/:operator_id/schedule', async (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const { from, to, vehicle, date } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "from" hoặc "to"'
        }
      });
    }

    const result = await getDepartureTimes(
      operator_id,
      from as string,
      to as string,
      vehicle as string,
      date as string
    );
    
    res.json(result);

  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống'
      }
    });
  }
});

// POST /api/route/check - Route check for frontend
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { from, to, vehicleType = 'bus' } = req.body;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "from" hoặc "to"'
        }
      });
    }

    const result = await checkRouteAndPrice('vu_han', from, to, vehicleType);
    
    res.json({
      valid: result.validity.all_valid,
      from: result.pickup.suggested_point,
      to: result.dropoff.suggested_point,
      normalizedFrom: result.pickup.suggested_point,
      normalizedTo: result.dropoff.suggested_point,
      price: result.ticket_fee?.amount_vnd,
      vehicleType,
      message: result.overall_response,
      alternatives: result.suggestions
    });

  } catch (error) {
    console.error('Route check error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống'
      }
    });
  }
});

// GET /api/route/schedule - Schedule for frontend
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const { from, to, vehicle, date } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Thiếu trường "from" hoặc "to"'
        }
      });
    }

    const result = await getDepartureTimes(
      'vu_han',
      from as string,
      to as string,
      vehicle as string,
      date as string
    );

    // Format cho frontend
    res.json({
      schedules: result.departures.map(d => ({
        time: d.time,
        from: result.from,
        to: result.to,
        vehicleType: d.vehicle_label,
        price: 0,
        availableSeats: undefined
      })),
      from: result.from,
      to: result.to,
      total: result.departures.length,
      qa_response: result.qa_response,          // Câu trả lời từ Markdown FAQ
      has_direct_answer: result.has_direct_answer,
      source: result.source,
    });

  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Lỗi hệ thống'
      }
    });
  }
});

export { router as routeRouter };
