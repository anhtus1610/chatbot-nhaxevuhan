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
  validation_messages?: string[];
}

import prisma from '../utils/prisma';

// Helper to save booking to PostgreSQL
async function saveBooking(booking: BookingInfo) {
  try {
    let customerId: string | undefined = undefined;

    if (booking.phone_number && booking.customer_name) {
      // 1. Upsert Customer (without total_tickets for now)
      const customer = await prisma.customer.upsert({
        where: { phone: booking.phone_number },
        update: { name: booking.customer_name },
        create: {
          name: booking.customer_name,
          phone: booking.phone_number,
          total_tickets: 0
        }
      });
      customerId = customer.id;

      // 2. Find if there is an existing booking for the same trip to UPDATE instead of CREATE
      const existingBooking = await prisma.booking.findFirst({
        where: {
          phone_number: booking.phone_number,
          departure_date: booking.departure_date,
          pickup: booking.pickup,
          dropoff: booking.dropoff
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingBooking) {
        // Update existing booking
        await prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            ticket_count: booking.ticket_count,
            vehicle_type: booking.vehicle_type,
            departure_time: booking.departure_time,
            status: booking.status,
            missing_fields: booking.missing_fields,
            confirmation_message: booking.confirmation_message,
            suggested_times: booking.suggested_times || [],
          }
        });
      } else {
        // Create new booking
        await prisma.booking.create({
          data: {
            customer_name: booking.customer_name,
            phone_number: booking.phone_number,
            pickup: booking.pickup,
            dropoff: booking.dropoff,
            departure_date: booking.departure_date,
            departure_time: booking.departure_time,
            vehicle_type: booking.vehicle_type,
            ticket_count: booking.ticket_count,
            status: booking.status,
            missing_fields: booking.missing_fields,
            confirmation_message: booking.confirmation_message,
            suggested_times: booking.suggested_times || [],
            customerId: customerId
          }
        });
      }

      // 3. Recalculate total tickets for this customer
      const allBookings = await prisma.booking.findMany({
        where: { customerId: customerId, status: { not: 'cancelled' } }
      });
      const totalTickets = allBookings.reduce((sum, b) => sum + (b.ticket_count || 1), 0);

      await prisma.customer.update({
        where: { id: customerId },
        data: { total_tickets: totalTickets }
      });

      console.log(`[collectBookingInfo] Upserted booking for ${booking.phone_number}. Total tickets: ${totalTickets}`);
    }
  } catch (error) {
    console.error('Lỗi lưu booking vào database:', error);
  }
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
  const validationMessages: string[] = []; // Dành cho AI đọc để thông báo lại khách

  if (!customer_name) missingFields.push('customer_name');

  if (phone_number === undefined || phone_number === null || String(phone_number).trim() === '') {
    missingFields.push('phone_number');
  } else {
    // Validate Vietnam phone number safely
    const phoneStr = String(phone_number);
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(phoneStr.replace(/[\s\-\.]/g, ''))) {
      missingFields.push('phone_number');
      validationMessages.push('Số điện thoại không đúng định dạng Việt Nam. Bắt buộc: AI thông báo cho khách lỗi này và yêu cầu khách nhập lại số điện thoại hợp lệ (10 số).');
    }
  }

  if (departure_date === undefined || departure_date === null || String(departure_date).trim() === '') {
    missingFields.push('departure_date');
  } else {
    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Auto convert DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD
    let parsedDateStr = String(departure_date);
    const dateParts = parsedDateStr.split(/[-/]/);
    if (dateParts.length === 3 && dateParts[0].length <= 2) {
      parsedDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }
    const dateObj = new Date(parsedDateStr);

    if (isNaN(dateObj.getTime())) {
      missingFields.push('departure_date');
      validationMessages.push('Ngày đi không nhận dạng được. Bắt buộc: AI thông báo lỗi này và yêu cầu khách xác nhận lại ngày đi.');
    } else if (dateObj.getTime() < today.getTime()) {
      missingFields.push('departure_date');
      validationMessages.push('Ngày đi không hợp lệ vì nằm trong quá khứ. Bắt buộc: AI thông báo cho khách lỗi này và yêu cầu khách chọn lại ngày đi (từ hôm nay trở đi).');
    }
  }

  if (!departure_time) missingFields.push('departure_time');
  if (!vehicle_type) missingFields.push('vehicle_type');

  if (ticket_count === undefined || ticket_count === null || ticket_count === '') {
    missingFields.push('ticket_count');
  } else {
    const count = Number(ticket_count);
    if (isNaN(count) || count <= 0) {
      missingFields.push('ticket_count');
      validationMessages.push('Số lượng vé không hợp lệ. Bắt buộc: AI thông báo lỗi này và yêu cầu khách nhập lại số lượng lớn hơn 0.');
    } else if (vehicle_type) {
      if (vehicle_type === 'vip' && count > 9) {
        missingFields.push('ticket_count');
        validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe VIP (tối đa 9 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe hoặc đổi loại xe.`);
      } else if (vehicle_type === 'ghe' && count > 29) {
        missingFields.push('ticket_count');
        validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe ghế ngồi (tối đa 29 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe hoặc đổi loại xe.`);
      } else if (vehicle_type === 'giuong' && count > 40) {
        missingFields.push('ticket_count');
        validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe giường nằm (tối đa 40 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe.`);
      }
    } else if (count > 40) {
      // Chưa chọn loại xe nhưng đặt > 40 vé thì chắc chắn quá 1 xe
      missingFields.push('ticket_count');
      validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe bất kỳ (tối đa 40 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe.`);
    }
  }

  let status: BookingInfo['status'] = missingFields.length === 0 ? 'complete' : 'incomplete';
  let suggestedTimes: string[] | undefined = undefined;

  // Validate departure_time and vehicle_type if formal schedules exist
  if (departure_time && pickup && dropoff) {
    const allDeparturesInfo = await getDepartureTimes(operatorId, pickup, dropoff, 'all', departure_date);
    const deps = allDeparturesInfo.departures;
    
    if (deps.length > 0) {
      // 1. Filter by vehicle_type
      let validDeps = deps;
      if (vehicle_type) {
        validDeps = deps.filter(d => {
          const lbl = d.vehicle_label.toLowerCase();
          if (vehicle_type === 'vip') return lbl.includes('vip') || lbl.includes('limousine');
          if (vehicle_type === 'giuong') return lbl.includes('giường');
          if (vehicle_type === 'ghe') return lbl.includes('ghế');
          return true;
        });
        
        if (validDeps.length === 0) {
           status = 'incomplete';
           if (!missingFields.includes('vehicle_type')) missingFields.push('vehicle_type');
           validationMessages.push(`Tuyến ${pickup} đi ${dropoff} không có loại xe ${getVehicleLabel(vehicle_type)}. Tuyến này chỉ có: ${[...new Set(deps.map(d => d.vehicle_label))].join(', ')}. Bắt buộc: AI thông báo cho khách lỗi này và yêu cầu đổi loại xe.`);
        }
      }
      
      // 2. Filter by departure_time
      if (validDeps.length > 0) {
         const availableTimes = validDeps.map(d => d.time);
         if (!availableTimes.includes(departure_time)) {
           status = 'invalid_time';
           suggestedTimes = availableTimes;
           if (!missingFields.includes('departure_time')) missingFields.push('departure_time');
         }
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
    suggested_times: suggestedTimes,
    validation_messages: validationMessages.length > 0 ? validationMessages : undefined
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

    // Save to PostgreSQL Database
    await saveBooking(result);
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
