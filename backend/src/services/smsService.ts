/**
 * SMS Service - Gửi SMS xác nhận đặt vé thành công
 * Hỗ trợ nhiều nhà cung cấp: SpeedSMS, eSMS, Twilio
 * Nếu chưa cấu hình credentials → chạy chế độ DEBUG (log ra console)
 */

import { BookingInfo } from '../tools/collectBookingInfo';

// ========== Interfaces ==========

interface SmsProvider {
  sendSms(phone: string, content: string): Promise<boolean>;
}

// ========== SpeedSMS Provider ==========

class SpeedSmsProvider implements SmsProvider {
  private apiKey: string;
  private sender: string;

  constructor(apiKey: string, sender: string) {
    this.apiKey = apiKey;
    this.sender = sender;
  }

  async sendSms(phone: string, content: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.speedsms.vn/index.php/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(this.apiKey + ':x').toString('base64')
        },
        body: JSON.stringify({
          to: [phone],
          content: content,
          sms_type: this.sender ? 2 : 5, // 2 = brandname, 5 = random number
          sender: this.sender || undefined
        })
      });

      const result: any = await response.json();
      if (result.status === 'success' || result.code === '00') {
        return true;
      }
      console.error('[SpeedSMS] Lỗi gửi SMS:', result);
      return false;
    } catch (error) {
      console.error('[SpeedSMS] Lỗi kết nối:', error);
      return false;
    }
  }
}

// ========== eSMS Provider ==========

class EsmsProvider implements SmsProvider {
  private apiKey: string;
  private secretKey: string;
  private brandname: string;

  constructor(apiKey: string, secretKey: string, brandname: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.brandname = brandname;
  }

  async sendSms(phone: string, content: string): Promise<boolean> {
    try {
      const response = await fetch('http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ApiKey: this.apiKey,
          Content: content,
          Phone: phone,
          SecretKey: this.secretKey,
          Brandname: this.brandname,
          SmsType: '2' // CSKH
        })
      });

      const result: any = await response.json();
      if (result.CodeResult === '100') {
        return true;
      }
      console.error('[eSMS] Lỗi gửi SMS:', result);
      return false;
    } catch (error) {
      console.error('[eSMS] Lỗi kết nối:', error);
      return false;
    }
  }
}

// ========== Twilio Provider ==========

class TwilioProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendSms(phone: string, content: string): Promise<boolean> {
    try {
      // Chuyển đổi SĐT Việt Nam sang format quốc tế
      let toPhone = phone;
      if (toPhone.startsWith('0')) {
        toPhone = '+84' + toPhone.substring(1);
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(this.accountSid + ':' + this.authToken).toString('base64')
        },
        body: new URLSearchParams({
          To: toPhone,
          From: this.fromNumber,
          Body: content
        }).toString()
      });

      const result: any = await response.json();
      if (result.sid) {
        return true;
      }
      console.error('[Twilio] Lỗi gửi SMS:', result);
      return false;
    } catch (error) {
      console.error('[Twilio] Lỗi kết nối:', error);
      return false;
    }
  }
}

// ========== Helper Functions ==========

function getVehicleLabel(type?: string): string {
  switch (type) {
    case 'giuong': return 'Giuong nam';
    case 'ghe': return 'Ghe ngoi';
    case 'vip': return 'VIP/Limousine';
    default: return type || '';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function buildSmsContent(booking: BookingInfo): string {
  const vehicleLabel = getVehicleLabel(booking.vehicle_type);
  const formattedDate = formatDate(booking.departure_date);
  const ticketCount = booking.ticket_count ?? 1;

  // SMS ngắn gọn, không dấu để tránh bị tính 2 tin (Unicode SMS chỉ 70 ký tự)
  return [
    `[Nha xe Vu Han] Dat ve thanh cong!`,
    `Ten: ${booking.customer_name || 'Quy khach'}`,
    `Tuyen: ${booking.pickup} -> ${booking.dropoff}`,
    `Ngay: ${formattedDate} - ${booking.departure_time || '---'}`,
    `Xe: ${vehicleLabel} - ${ticketCount} ve`,
    `CK: 8686111085 Techcombank - Bui Thi Minh Hang`,
    `Hotline: 0866.111.085`
  ].join('\n');
}

// ========== Lazy-init Provider ==========

let _provider: SmsProvider | null = null;

function getProvider(): SmsProvider | null {
  if (_provider) return _provider;

  const providerName = (process.env.SMS_PROVIDER || '').toLowerCase();
  const apiKey = process.env.SMS_API_KEY;

  if (!apiKey) {
    console.warn('[SmsService] SMS_API_KEY chưa được cấu hình. SMS sẽ chỉ được log ra console.');
    return null;
  }

  switch (providerName) {
    case 'speedsms':
      _provider = new SpeedSmsProvider(apiKey, process.env.SMS_SENDER || '');
      break;
    case 'esms':
      _provider = new EsmsProvider(apiKey, process.env.SMS_SECRET_KEY || '', process.env.SMS_SENDER || '');
      break;
    case 'twilio':
      _provider = new TwilioProvider(
        process.env.SMS_ACCOUNT_SID || '',
        apiKey,
        process.env.SMS_SENDER || ''
      );
      break;
    default:
      console.warn(`[SmsService] SMS_PROVIDER "${providerName}" không được hỗ trợ. Sử dụng debug mode.`);
      return null;
  }

  console.log(`[SmsService] Đã khởi tạo provider: ${providerName}`);
  return _provider;
}

// ========== SMS Service ==========

export class SmsService {
  /**
   * Gửi SMS xác nhận đặt vé thành công
   * @returns true nếu gửi thành công, false nếu thất bại hoặc chạy ở chế độ debug
   */
  static async sendBookingConfirmation(booking: BookingInfo): Promise<boolean> {
    if (!booking.phone_number) {
      console.warn('[SmsService] Không có SĐT trong booking info, bỏ qua gửi SMS.');
      return false;
    }

    const smsContent = buildSmsContent(booking);
    const provider = getProvider();

    // Chế độ Debug: không có provider thì chỉ log ra console
    if (!provider) {
      console.log('\n========== [SmsService] DEBUG MODE ==========');
      console.log(`📱 To: ${booking.phone_number}`);
      console.log(`📋 Content:\n${smsContent}`);
      console.log('==============================================\n');
      return false;
    }

    try {
      const success = await provider.sendSms(booking.phone_number, smsContent);
      if (success) {
        console.log(`[SmsService] ✅ SMS đã gửi thành công đến ${booking.phone_number}`);
      } else {
        console.error(`[SmsService] ❌ Gửi SMS thất bại đến ${booking.phone_number}`);
      }
      return success;
    } catch (error) {
      console.error(`[SmsService] ❌ Lỗi gửi SMS đến ${booking.phone_number}:`, error);
      return false;
    }
  }
}
