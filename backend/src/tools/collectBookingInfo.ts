import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Tool thu thập thông tin đặt vé
 */

export interface BookingInfo {
  customer_name?: string;
  phone_number?: string;
  pickup: string;
  dropoff: string;
  departure_date?: string;
  departure_time?: string;
  vehicle_type?: string;
  ticket_count?: number;
  status: 'incomplete' | 'complete' | 'pending_confirmation' | 'invalid_time';
  missing_fields: string[];
  confirmation_message?: string;
  suggested_times?: string[];
}

const DATA_DIR = path.join(__dirname, '../../../data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// Helper to save booking
function saveBooking(booking: BookingInfo) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let bookings = [];
  if (fs.existsSync(BOOKINGS_FILE)) {
    try {
      bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
    } catch (e) {
      console.error('Lỗi đọc bookings.json:', e);
    }
  }

  const newBooking = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...booking
  };

  bookings.unshift(newBooking); // Add to beginning (newest first)
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
}

import { getDepartureTimes } from './getDepartureTimes';

export async function collectBookingInfo(args: any, operatorId: string = 'vu_han'): Promise<BookingInfo> {
  const {
    customer_name,
    phone_number,
    pickup,
    dropoff,
    departure_date,
    departure_time,
    vehicle_type,
    ticket_count
  } = args;

  const missingFields: string[] = [];

  if (!customer_name) missingFields.push('customer_name');
  if (!phone_number) missingFields.push('phone_number');
  if (!departure_date) missingFields.push('departure_date');
  if (!departure_time) missingFields.push('departure_time');
  if (!vehicle_type) missingFields.push('vehicle_type');
  if (!ticket_count) missingFields.push('ticket_count');

  let status: BookingInfo['status'] = missingFields.length === 0 ? 'complete' : 'incomplete';
  let suggestedTimes: string[] | undefined = undefined;

  // Validate departure_time if provided
  if (departure_time && pickup && dropoff) {
    const mappedVehicle = vehicle_type === 'vip' ? 'limousine' : (vehicle_type ? 'bus' : 'all');
    const departuresInfo = await getDepartureTimes(operatorId, pickup, dropoff, mappedVehicle, departure_date);
    if (departuresInfo.departures.length > 0) {
      const availableTimes = departuresInfo.departures.map(d => d.time);
      if (!availableTimes.includes(departure_time)) {
        status = 'invalid_time';
        suggestedTimes = availableTimes;
        missingFields.push('departure_time');
      }
    }
  }

  const result: BookingInfo = {
    customer_name,
    phone_number,
    pickup,
    dropoff,
    departure_date,
    departure_time,
    vehicle_type,
    ticket_count,
    status,
    missing_fields: missingFields,
    suggested_times: suggestedTimes
  };

  if (status === 'complete') {
    result.confirmation_message = `Dạ em xác nhận đặt vé:
• ${ticket_count || 1} vé ${getVehicleLabel(vehicle_type)} ${pickup} → ${dropoff}
• Ngày: ${departure_date} - Chuyến: ${departure_time}
• Tên: ${customer_name}
• SĐT: ${phone_number}

Anh/chị chuyển khoản để giữ chỗ nhé ạ.
Tìm Zalo OA "Xe khách Vũ Hán" (tích vàng) để xem thông tin thanh toán ạ.
Lái phụ xe sẽ liên hệ trước 1-2 tiếng hẹn điểm đón ạ. 🙏`;

    // Save to JSON
    saveBooking(result);
  }

  return result;
}

function getVehicleLabel(type?: string): string {
  switch (type) {
    case 'giuong': return 'giường nằm';
    case 'ghe': return 'ghế ngồi';
    case 'vip': return 'VIP/Limousine';
    default: return '';
  }
}
