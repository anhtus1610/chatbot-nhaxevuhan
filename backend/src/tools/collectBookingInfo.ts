import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Tool thu thập thông tin đặt vé
 */

export interface BookingInfo {
  customer_name?: string;
  phone_number?: string;
  email?: string;
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
import { SmsService } from '../services/smsService';

function getSessionIndicator(text: string, matchIndex: number, matchLength: number): 'pm' | 'am_sáng' | 'am_trưa' | 'none' {
  const textLower = text.toLowerCase();

  // Look ahead up to 15 characters, but stop at comma or period
  const after = textLower.substring(matchIndex + matchLength, matchIndex + matchLength + 15).split(/[.,]/)[0];

  // Look behind up to 15 characters, but stop at comma or period
  const beforeStart = Math.max(0, matchIndex - 15);
  const beforeParts = textLower.substring(beforeStart, matchIndex).split(/[.,]/);
  const before = beforeParts[beforeParts.length - 1]; // get the part closest to the match

  const combined = before + ' ' + after;
  if (combined.includes('tối') || combined.includes('đêm') || combined.includes('chiều')) {
    return 'pm';
  }
  if (combined.includes('sáng')) {
    return 'am_sáng';
  }
  if (combined.includes('trưa')) {
    return 'am_trưa';
  }
  return 'none';
}

function extractTimesFromText(text: string): string[] {
  const timesSet = new Set<string>();
  const textLower = text.toLowerCase();
  let match;

  // 1. Trích xuất dạng chuẩn HH:MM hoặc HHhMM (VD: 19:30, 19h30, 07:30, 7h30)
  const standardRegex = /(\d{1,2})\s*[h:]\s*(\d{2})/gi;
  while ((match = standardRegex.exec(text)) !== null) {
    let hour = parseInt(match[1], 10);
    const minute = match[2];

    // Kiểm tra buổi xung quanh để đổi sang 24h
    if (hour <= 12) {
      const session = getSessionIndicator(text, match.index, match[0].length);
      if (session === 'pm') {
        if (hour < 12) hour += 12;
        else if (hour === 12) hour = 0; // 12h đêm
      } else if (session === 'am_sáng' && hour === 12) {
        hour = 0; // 12h sáng (nửa đêm)
      }
    }
    timesSet.add(`${hour.toString().padStart(2, '0')}:${minute}`);
  }

  // 2. Trích xuất giờ rưỡi: X rưỡi, Xh rưỡi, X giờ rưỡi (VD: 7 rưỡi, 5 rưỡi sáng)
  const ruoiRegex = /(\d{1,2})\s*(?:giờ|h)?\s*rưỡi/gi;
  while ((match = ruoiRegex.exec(text)) !== null) {
    let hour = parseInt(match[1], 10);
    const minute = '30';

    if (hour <= 12) {
      const session = getSessionIndicator(text, match.index, match[0].length);
      if (session === 'pm') {
        if (hour < 12) hour += 12;
        else if (hour === 12) hour = 0;
      } else if (session === 'am_sáng' && hour === 12) {
        hour = 0;
      }
    }
    timesSet.add(`${hour.toString().padStart(2, '0')}:${minute}`);
  }

  // 3. Trích xuất giờ kém: Xh kém Y (VD: 6h kém 15)
  const kemRegex = /(\d{1,2})\s*(?:giờ|h)\s*kém\s*(\d{1,2})/gi;
  while ((match = kemRegex.exec(text)) !== null) {
    let hour = parseInt(match[1], 10);
    const kemMinutes = parseInt(match[2], 10);

    let targetHour = hour - 1;
    let targetMinute = 60 - kemMinutes;

    if (targetHour < 0) targetHour = 23;

    if (targetHour <= 12) {
      const session = getSessionIndicator(text, match.index, match[0].length);
      if (session === 'pm') {
        if (targetHour < 12) targetHour += 12;
        else if (targetHour === 12) targetHour = 0;
      } else if (session === 'am_sáng' && targetHour === 12) {
        targetHour = 0;
      }
    }

    if (targetHour >= 0 && targetMinute >= 0 && targetMinute < 60) {
      timesSet.add(`${targetHour.toString().padStart(2, '0')}:${targetMinute.toString().padStart(2, '0')}`);
    }
  }

  // 4. Trích xuất giờ chẵn: Xh, X giờ (VD: 16h, 1h sáng, 15h, 12h đêm)
  // Loại trừ "hơn" (như 7h hơn) và "tiếng" (như đi 3 tiếng, 1 tiếng rưỡi) và "kém" (đã xử lý ở trên)
  const hourRegex = /(\d{1,2})\s*(?:giờ|h)(?!\s*hơn)(?!\s*tiếng)(?!\s*kém)/gi;
  while ((match = hourRegex.exec(text)) !== null) {
    let hour = parseInt(match[1], 10);
    const minute = '00';

    const index = match.index;
    const matchLength = match[0].length;
    const subAfter = textLower.substring(index + matchLength, index + matchLength + 15);

    // Nếu đây là một phần của giờ rưỡi hoặc giờ có phút (HH:MM), bỏ qua
    if (subAfter.match(/^\s*(?:giờ|h)?\s*rưỡi/) || subAfter.match(/^\s*\d{2}/) || subAfter.match(/^[h:]\s*\d{2}/)) {
      continue;
    }

    if (hour <= 12) {
      const session = getSessionIndicator(text, index, matchLength);
      if (session === 'pm') {
        if (hour < 12) hour += 12;
        else if (hour === 12) hour = 0;
      } else if (session === 'am_sáng' && hour === 12) {
        hour = 0;
      }
    }

    timesSet.add(`${hour.toString().padStart(2, '0')}:${minute}`);
  }

  return Array.from(timesSet).sort();
}

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
            email: booking.email,
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
            email: booking.email,
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

      // 3. Upsert email vào Customer nếu có
      if (booking.email) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { email: booking.email }
        });
      }

      // 4. Recalculate total tickets for this customer
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
    email,
    pickup,
    dropoff,
    departure_date,
    departure_time,
    vehicle_type,
    ticket_count
  } = args;

  const missingFields: string[] = [];
  const validationMessages: string[] = []; // Dành cho AI đọc để thông báo lại khách

  const tripMissingFields: string[] = [];
  const personalMissingFields: string[] = [];

  // 1. Kiểm tra các thông tin cá nhân
  if (!customer_name) personalMissingFields.push('customer_name');

  if (phone_number === undefined || phone_number === null || String(phone_number).trim() === '') {
    personalMissingFields.push('phone_number');
  } else {
    const phoneStr = String(phone_number);
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(phoneStr.replace(/[\s\-\.]/g, ''))) {
      personalMissingFields.push('phone_number');
      validationMessages.push('Số điện thoại không đúng định dạng Việt Nam. Bắt buộc: AI thông báo cho khách lỗi này và yêu cầu khách nhập lại số điện thoại hợp lệ (10 số).');
    }
  }

  // 2. Kiểm tra các thông tin chuyến đi
  if (departure_date === undefined || departure_date === null || String(departure_date).trim() === '') {
    tripMissingFields.push('departure_date');
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let parsedDateStr = String(departure_date);
    const dateParts = parsedDateStr.split(/[-/]/);
    if (dateParts.length === 3 && dateParts[0].length <= 2) {
      parsedDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }
    const dateObj = new Date(parsedDateStr);

    if (isNaN(dateObj.getTime())) {
      tripMissingFields.push('departure_date');
      validationMessages.push('Ngày đi không nhận dạng được. Bắt buộc: AI thông báo lỗi này và yêu cầu khách xác nhận lại ngày đi.');
    } else if (dateObj.getTime() < today.getTime()) {
      tripMissingFields.push('departure_date');
      validationMessages.push('Ngày đi không hợp lệ vì nằm trong quá khứ. Bắt buộc: AI thông báo cho khách lỗi này và yêu cầu khách chọn lại ngày đi (từ hôm nay trở đi).');
    } else if (dateObj.getTime() === today.getTime() && departure_time) {
      // Kiểm tra giờ đi đã qua chưa (cùng ngày hôm nay)
      const now = new Date();
      const [hours, minutes] = String(departure_time).split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const departureMinutes = hours * 60 + minutes;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (departureMinutes <= currentMinutes) {
          tripMissingFields.push('departure_time');
          validationMessages.push(`Giờ đi ${departure_time} đã qua rồi (hiện tại là ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}). Bắt buộc: AI thông báo cho khách rằng giờ này đã qua và gợi ý chọn chuyến muộn hơn trong ngày hoặc đặt vé ngày mai.`);
        }
      }
    }
  }

  if (!departure_time) tripMissingFields.push('departure_time');
  if (!vehicle_type) tripMissingFields.push('vehicle_type');

  let hasTicketCount = false;
  if (ticket_count === undefined || ticket_count === null || ticket_count === '') {
    tripMissingFields.push('ticket_count');
  } else {
    const count = Number(ticket_count);
    if (isNaN(count) || count <= 0) {
      tripMissingFields.push('ticket_count');
      validationMessages.push('Số lượng vé không hợp lệ. Bắt buộc: AI thông báo lỗi này và yêu cầu khách nhập lại số lượng lớn hơn 0.');
    } else {
      hasTicketCount = true;
      if (vehicle_type) {
        if (vehicle_type === 'vip' && count > 9) {
          tripMissingFields.push('ticket_count');
          validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe VIP (tối đa 9 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe hoặc đổi loại xe.`);
          hasTicketCount = false;
        } else if (vehicle_type === 'ghe' && count > 29) {
          tripMissingFields.push('ticket_count');
          validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe ghế ngồi (tối đa 29 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe hoặc đổi loại xe.`);
          hasTicketCount = false;
        } else if (vehicle_type === 'giuong' && count > 40) {
          tripMissingFields.push('ticket_count');
          validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe giường nằm (tối đa 40 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe.`);
          hasTicketCount = false;
        }
      } else if (count > 40) {
        tripMissingFields.push('ticket_count');
        validationMessages.push(`Số lượng ${count} vé vượt quá sức chứa của 1 xe bất kỳ (tối đa 40 chỗ). Bắt buộc: AI thông báo cho khách và gợi ý tách ra nhiều xe.`);
        hasTicketCount = false;
      }
    }
  }

  // QUY TẮC: Chỉ yêu cầu thông tin cá nhân (Tên, SĐT, Email) khi đã có số lượng vé hợp lệ
  if (!hasTicketCount) {
    missingFields.push(...tripMissingFields);
    validationMessages.push('Vui lòng hỏi khách thông tin chuyến đi (số lượng vé, loại xe, giờ đi...). TUYỆT ĐỐI CHƯA hỏi tên, sđt ở bước này vì khách chưa chốt số lượng vé.');
  } else {
    // Đã có ticket_count, yêu cầu cả các thông tin chuyến đi còn lại và thông tin cá nhân
    missingFields.push(...tripMissingFields);
    missingFields.push(...personalMissingFields);
    if (personalMissingFields.length > 0) {
      validationMessages.push('Thiếu thông tin khách hàng. Bắt buộc: AI yêu cầu khách cung cấp thông tin (Tên, SĐT) để hoàn tất đặt vé.');
    }
  }

  let status: BookingInfo['status'] = missingFields.length === 0 ? 'complete' : 'incomplete';
  let suggestedTimes: string[] | undefined = undefined;

  // Validate vehicle_type and departure_time if formal schedules exist
  if (pickup && dropoff) {
    const allDeparturesInfo = await getDepartureTimes(operatorId, pickup, dropoff, 'all', departure_date);
    const deps = allDeparturesInfo.departures;

    let availableTimes: string[] = [];
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

      if (validDeps.length > 0) {
        availableTimes = validDeps.map(d => d.time);
      }
    } else if (allDeparturesInfo.qa_response) {
      // Trích xuất các giờ xe chạy từ câu trả lời văn bản Q&A bằng hàm phân tích thông minh
      availableTimes = extractTimesFromText(allDeparturesInfo.qa_response);
    }

    // Kiểm tra tính hợp lệ của giờ đi
    if (availableTimes.length > 0 && departure_time) {
      if (!availableTimes.includes(departure_time)) {
        status = 'invalid_time';
        suggestedTimes = availableTimes;
        if (!missingFields.includes('departure_time')) {
          missingFields.push('departure_time');
        }
        validationMessages.push(`Giờ xe chạy ${departure_time} không khớp với lịch chạy của nhà xe. Các giờ hiện có: ${availableTimes.join(', ')}.`);
      }
    }
  }

  const result: BookingInfo = {
    customer_name,
    phone_number,
    email: email ? String(email).trim() : undefined,
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
Tin nhắn SMS xác nhận hành trình đã được gửi đến điện thoại của anh/chị.

Anh/chị chuyển khoản để giữ chỗ nhé ạ.
Tìm Zalo OA "Xe khách Vũ Hán" (tích vàng) để xem thông tin thanh toán ạ.
Lái phụ xe sẽ liên hệ trước 1-2 tiếng hẹn điểm đón ạ. 🙏

👉 *Anh/chị có muốn tham khảo hoặc đặt thêm vé chiều về (từ ${dropoff} về ${pickup}) không ạ? Nếu có, anh/chị nhắn em nhé!*`;

    // Save to PostgreSQL Database
    await saveBooking(result);

    // Gửi tin nhắn SMS xác nhận hành trình đến khách hàng
    await SmsService.sendBookingSms(result);
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
