/**
 * SMS Service - Gửi tin nhắn SMS xác nhận đặt vé xe cho khách hàng
 * Hỗ trợ SpeedSMS, eSMS và chế độ Debug (in log ra console)
 * Dành cho Đồ án Tốt nghiệp
 */

import { BookingInfo } from '../tools/collectBookingInfo';

/**
 * Loại bỏ dấu tiếng Việt để tin nhắn ngắn gọn, tránh lỗi hiển thị và tiết kiệm chi phí SMS
 */
export function removeVietnameseTones(str: string): string {
  return str
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, 'A')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, 'E')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[ÌÍỊỈĨ]/g, 'I')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, 'O')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, 'U')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[ỲÝỴỶỸ]/g, 'Y')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    // Một số dấu ký tự đặc biệt khác
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Chuẩn hóa số điện thoại về định dạng trong nước (09...)
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\.\+]/g, '');
  if (cleaned.startsWith('84') && cleaned.length > 10) {
    cleaned = '0' + cleaned.substring(2);
  }
  // Nếu số điện thoại chỉ có 9 chữ số và bắt đầu bằng đầu số di động (3, 5, 7, 8, 9), thêm số 0 vào đầu
  if (/^[35789]\d{8}$/.test(cleaned)) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

function getVehicleLabelVi(type?: string): string {
  switch (type) {
    case 'giuong': return 'Giuong nam';
    case 'ghe': return 'Ghe ngoi';
    case 'vip': return 'VIP Limousine';
    default: return type || '';
  }
}

function formatDateSms(dateStr?: string): string {
  if (!dateStr) return '';
  // Nếu định dạng YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  // Nếu định dạng DD/MM/YYYY
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    return `${slashParts[0]}/${slashParts[1]}`;
  }
  return dateStr;
}

export class SmsService {
  /**
   * Tạo nội dung tin nhắn SMS chi tiết vé xe (không dấu)
   */
  static buildSmsContent(booking: BookingInfo): string {
    const ticketCount = booking.ticket_count || 1;
    const formattedDate = formatDateSms(booking.departure_date);
    const time = booking.departure_time || '';
    const name = booking.customer_name || '';

    const text = `Nha xe Vu Han xac nhan: Hanh trinh ${booking.pickup} - ${booking.dropoff}. Khach hang: ${name}. So ve: ${ticketCount}. Gio di: ${time} ngay ${formattedDate}. Cam on quy khach!`;
    return removeVietnameseTones(text);
  }

  /**
   * Phương thức chính gửi tin nhắn SMS
   */
  static async sendBookingSms(booking: BookingInfo): Promise<boolean> {
    if (!booking.phone_number) {
      console.warn('[SmsService] Khách hàng không có số điện thoại, bỏ qua gửi SMS.');
      return false;
    }

    const provider = (process.env.SMS_PROVIDER || 'debug').toLowerCase();
    const phone = normalizePhone(booking.phone_number);
    const content = this.buildSmsContent(booking);

    // CHẾ ĐỘ 1: DEBUG / CONSOLE LOG (Miễn phí, thích hợp chạy local & demo chấm thi)
    if (provider === 'debug' || provider === 'none') {
      console.log('\n=================== [SmsService] DEBUG MODE ===================');
      console.log(`📱 Gửi tới SĐT: ${phone}`);
      console.log(`📋 Nội dung SMS: \n${content} `);
      console.log(`💡 (Cấu hình SMS_PROVIDER = speedsms hoặc esms trong.env để gửi thật)`);
      console.log('===============================================================\n');
      return true;
    }

    // CHẾ ĐỘ 2: GỬI QUA SPEEDSMS
    if (provider === 'speedsms') {
      const apiKey = process.env.SPEEDSMS_API_KEY;
      if (!apiKey || apiKey.includes('your_')) {
        console.error('[SmsService] Chưa cấu hình SPEEDSMS_API_KEY trong file .env');
        return false;
      }

      try {
        console.log(`[SmsService] Đang gửi SMS qua SpeedSMS đến số: ${phone}...`);
        const authHeader = 'Basic ' + Buffer.from(apiKey + ':x').toString('base64');

        const response = await fetch('https://api.speedsms.vn/index.php/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            to: [phone],
            content: content,
            sms_type: Number(process.env.SPEEDSMS_TYPE || '2'), // Cấu hình qua SPEEDSMS_TYPE (2: đầu số ngẫu nhiên, 5: android, 3: brandname)
            sender: process.env.SPEEDSMS_SENDER || ''           // Cấu hình qua SPEEDSMS_SENDER (tên brandname hoặc deviceId của android)
          })
        });

        const result: any = await response.json();
        if (result.code === '00' || result.status === 'success') {
          console.log(`[SmsService] ✅ Đã gửi SMS thành công qua SpeedSMS.Transaction ID: ${result.data?.tranId || 'N/A'} `);
          return true;
        } else {
          console.error('[SmsService] ❌ Gửi SMS qua SpeedSMS thất bại:', result);
          return false;
        }
      } catch (err) {
        console.error('[SmsService] ❌ Lỗi kết nối API SpeedSMS:', err);
        return false;
      }
    }

    // CHẾ ĐỘ 3: GỬI QUA ESMS
    if (provider === 'esms') {
      const apiKey = process.env.ESMS_API_KEY;
      const secretKey = process.env.ESMS_SECRET_KEY;

      if (!apiKey || apiKey.includes('your_') || !secretKey || secretKey.includes('your_')) {
        console.error('[SmsService] Chưa cấu hình đầy đủ ESMS_API_KEY hoặc ESMS_SECRET_KEY trong file .env');
        return false;
      }

      try {
        console.log(`[SmsService] Đang gửi SMS qua eSMS đến số: ${phone}...`);
        const response = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ApiKey: apiKey,
            SecretKey: secretKey,
            Phone: phone,
            Content: content,
            Brandname: "",
            SmsType: '8', // 8 = Tin nhắn đầu số cố định/ngẫu nhiên chăm sóc khách hàng (giá rẻ, không cần brandname)
            IsUnicode: '0', // 0 = Gửi tin nhắn không dấu
            Sandbox: '0'
          })
        });

        const responseText = await response.text();
        console.log(`[SmsService] Phản hồi thô từ eSMS: `, responseText);

        let result: any;
        try {
          result = JSON.parse(responseText);
        } catch (parseErr) {
          console.error('[SmsService] ❌ Phản hồi từ eSMS không phải là định dạng JSON hợp lệ:', responseText);
          return false;
        }

        // Cấu trúc phản hồi eSMS thành công: { CodeResponse: '100', SMSID: '...' } hoặc CodeResult
        const code = String(result.CodeResponse || result.CodeResult || '');
        if (code === '100') {
          console.log(`[SmsService] ✅ Đã gửi SMS thành công qua eSMS.SMS ID: ${result.SMSID || 'N/A'} `);
          return true;
        } else {
          console.error('[SmsService] ❌ Gửi SMS qua eSMS thất bại:', result);
          return false;
        }
      } catch (err) {
        console.error('[SmsService] ❌ Lỗi kết nối API eSMS:', err);
        return false;
      }
    }

    console.warn(`[SmsService] Cấu hình SMS_PROVIDER = "${provider}" không được hỗ trợ.`);
    return false;
  }
}
