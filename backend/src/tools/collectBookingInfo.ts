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
