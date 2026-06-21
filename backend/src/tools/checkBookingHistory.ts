import prisma from '../utils/prisma';

export interface BookingHistoryResult {
  phone_number: string;
  has_history: boolean;
  bookings: Array<{
    pickup: string;
    dropoff: string;
    vehicle_type: string | null;
    departure_date: string | null;
    departure_time: string | null;
    ticket_count: number | null;
  }>;
  message?: string;
}

export async function checkBookingHistory(
  phone_number: string,
  limit: number = 3
): Promise<BookingHistoryResult> {
  try {
    // Chuẩn hóa số điện thoại (bỏ khoảng trắng)
    const normalizedPhone = phone_number.replace(/[\s\-\.]/g, '');

    const pastBookings = await prisma.booking.findMany({
      where: {
        phone_number: {
          contains: normalizedPhone
        },
        status: 'complete'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      select: {
        pickup: true,
        dropoff: true,
        vehicle_type: true,
        departure_date: true,
        departure_time: true,
        ticket_count: true,
        createdAt: true
      }
    });

    if (pastBookings.length === 0) {
      return {
        phone_number: normalizedPhone,
        has_history: false,
        bookings: [],
        message: 'Khách hàng chưa có lịch sử đặt vé nào thành công.'
      };
    }

    // Lọc ra các tuyến độc nhất (distinct routes) nếu muốn, 
    // ở đây trả về nguyên list để bot tự tổng hợp.
    return {
      phone_number: normalizedPhone,
      has_history: true,
      bookings: pastBookings.map(b => ({
        pickup: b.pickup,
        dropoff: b.dropoff,
        vehicle_type: b.vehicle_type,
        departure_date: b.departure_date,
        departure_time: b.departure_time,
        ticket_count: b.ticket_count
      }))
    };
  } catch (error) {
    console.error('Lỗi khi tra cứu lịch sử đặt vé:', error);
    return {
      phone_number,
      has_history: false,
      bookings: [],
      message: 'Đã xảy ra lỗi khi tra cứu CSDL.'
    };
  }
}
