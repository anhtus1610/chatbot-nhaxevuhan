/**
 * Email Service - Gửi email xác nhận đặt vé thành công
 * Sử dụng nodemailer với Gmail App Password
 */

import nodemailer from 'nodemailer';
import { BookingInfo } from '../tools/collectBookingInfo';

// Lazy-init transporter
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('[EmailService] EMAIL_USER hoặc EMAIL_PASS chưa được cấu hình. Email sẽ chỉ được log ra console.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  return _transporter;
}

function getVehicleLabel(type?: string): string {
  switch (type) {
    case 'giuong': return 'Giường nằm';
    case 'ghe': return 'Ghế ngồi';
    case 'vip': return 'VIP/Limousine';
    default: return type || '';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  // dateStr: YYYY-MM-DD → DD/MM/YYYY
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function buildEmailHTML(booking: BookingInfo): string {
  const vehicleLabel = getVehicleLabel(booking.vehicle_type);
  const formattedDate = formatDate(booking.departure_date);
  const ticketCount = booking.ticket_count ?? 1;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xác nhận đặt vé - Nhà xe Vũ Hán</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #1a202c; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
    
    /* Header */
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 36px 32px; text-align: center; }
    .header .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: 1px; }
    .header .logo span { color: #facc15; }
    .header .subtitle { color: #bfdbfe; font-size: 14px; margin-top: 6px; }
    
    /* Success banner */
    .success-banner { background: linear-gradient(135deg, #065f46, #059669); padding: 20px 32px; text-align: center; }
    .success-banner .icon { font-size: 40px; }
    .success-banner .title { color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 8px; }
    .success-banner .desc { color: #a7f3d0; font-size: 14px; margin-top: 4px; }
    
    /* Content */
    .content { padding: 32px; }
    .greeting { font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6; }
    .greeting strong { color: #1e3a5f; }
    
    /* Ticket card */
    .ticket { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .ticket-header { background: #1e3a5f; padding: 14px 20px; display: flex; align-items: center; gap: 10px; }
    .ticket-header .t-icon { font-size: 20px; }
    .ticket-header .t-title { color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
    .ticket-body { padding: 20px; }
    .route { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #cbd5e1; }
    .route .city { text-align: center; }
    .route .city-name { font-size: 20px; font-weight: 800; color: #1e3a5f; }
    .route .city-label { font-size: 11px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .route .arrow { font-size: 24px; color: #2563eb; flex-shrink: 0; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .info-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-item .value { font-size: 15px; font-weight: 700; color: #1e3a5f; }
    .info-item.wide { grid-column: 1 / -1; }
    
    /* Booking ID */
    .booking-id { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; text-align: center; margin-top: 16px; }
    .booking-id .label { font-size: 11px; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; }
    .booking-id .id { font-size: 13px; font-weight: 700; color: #1e40af; font-family: monospace; margin-top: 4px; }
    
    /* Payment info */
    .payment { background: #fffbeb; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .payment .p-title { font-size: 16px; font-weight: 700; color: #92400e; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .payment .p-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 14px; color: #78350f; line-height: 1.5; }
    .payment .p-item .dot { color: #d97706; font-weight: bold; flex-shrink: 0; margin-top: 2px; }
    .payment .bank-info { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin-top: 12px; text-align: center; }
    .payment .bank-name { font-size: 18px; font-weight: 800; color: #92400e; }
    .payment .bank-detail { font-size: 13px; color: #78350f; margin-top: 4px; }
    
    /* Notice */
    .notice { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .notice .n-title { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px; }
    .notice .n-item { font-size: 13px; color: #166534; display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; line-height: 1.5; }
    
    /* Footer */
    .footer { background: #1e3a5f; padding: 24px 32px; text-align: center; }
    .footer .f-title { color: #facc15; font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .footer .f-contact { color: #bfdbfe; font-size: 13px; line-height: 1.8; }
    .footer .f-copy { color: #64748b; font-size: 11px; margin-top: 16px; }
    
    @media (max-width: 480px) {
      .info-grid { grid-template-columns: 1fr; }
      .info-item.wide { grid-column: 1; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header -->
    <div class="header">
      <div class="logo">🚌 Nhà xe <span>Vũ Hán</span></div>
      <div class="subtitle">Kết nối Hà Nội · Tuyên Quang · Hà Giang · Lào Cai</div>
    </div>
    
    <!-- Success banner -->
    <div class="success-banner">
      <div class="icon">✅</div>
      <div class="title">Đặt vé thành công!</div>
      <div class="desc">Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của Nhà xe Vũ Hán</div>
    </div>
    
    <!-- Main content -->
    <div class="content">
      <p class="greeting">
        Xin chào <strong>${booking.customer_name || 'Quý khách'}</strong>! 🎉<br/>
        Chúng tôi đã nhận được thông tin đặt vé của bạn. 
        Vui lòng xem lại thông tin vé bên dưới và hoàn tất thanh toán để giữ chỗ.
      </p>
      
      <!-- Ticket info -->
      <div class="ticket">
        <div class="ticket-header">
          <span class="t-icon">🎫</span>
          <span class="t-title">THÔNG TIN VÉ XE</span>
        </div>
        <div class="ticket-body">
          <div class="route">
            <div class="city">
              <div class="city-name">${booking.pickup}</div>
              <div class="city-label">Điểm đón</div>
            </div>
            <div class="arrow">→</div>
            <div class="city">
              <div class="city-name">${booking.dropoff}</div>
              <div class="city-label">Điểm trả</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="label">📅 Ngày đi</div>
              <div class="value">${formattedDate}</div>
            </div>
            <div class="info-item">
              <div class="label">🕐 Giờ chuyến</div>
              <div class="value">${booking.departure_time || '---'}</div>
            </div>
            <div class="info-item">
              <div class="label">🚌 Loại xe</div>
              <div class="value">${vehicleLabel}</div>
            </div>
            <div class="info-item">
              <div class="label">🎟️ Số vé</div>
              <div class="value">${ticketCount} vé</div>
            </div>
            <div class="info-item wide">
              <div class="label">👤 Họ tên</div>
              <div class="value">${booking.customer_name || '---'}</div>
            </div>
            <div class="info-item wide">
              <div class="label">📞 Số điện thoại</div>
              <div class="value">${booking.phone_number || '---'}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Payment info -->
      <div class="payment">
        <div class="p-title">💳 Hướng dẫn thanh toán</div>
        <div class="p-item"><span class="dot">▸</span> Chuyển khoản ngân hàng để giữ chỗ:</div>
        <div class="bank-info">
          <div class="bank-name">Techcombank</div>
          <div class="bank-detail">STK: <strong>8686111085</strong> — Bùi Thị Minh Hằng</div>
        </div>
        <div class="p-item" style="margin-top:12px"><span class="dot">▸</span> Hoặc tìm Zalo OA <strong>"Xe khách Vũ Hán"</strong> (tích vàng) để xem thông tin thanh toán chi tiết.</div>
        <div class="p-item"><span class="dot">▸</span> Nội dung chuyển khoản: <strong>${booking.customer_name || 'Họ tên'} - ${booking.phone_number || 'SĐT'}</strong></div>
      </div>
      
      <!-- Notice -->
      <div class="notice">
        <div class="n-title">📋 Lưu ý quan trọng</div>
        <div class="n-item"><span>✔️</span> Lái/phụ xe sẽ gọi điện xác nhận điểm đón trước <strong>1–2 tiếng</strong> khi xuất phát.</div>
        <div class="n-item"><span>✔️</span> Vui lòng có mặt tại điểm đón trước <strong>10–15 phút</strong>.</div>
        <div class="n-item"><span>✔️</span> Mang theo CCCD/CMND nếu được yêu cầu.</div>
        <div class="n-item"><span>✔️</span> Nếu cần hỗ trợ, liên hệ hotline: <strong>0866.111.085</strong>.</div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="f-title">🚌 Nhà xe Vũ Hán</div>
      <div class="f-contact">
        📞 Hotline: 0866.111.085<br/>
        💬 Zalo OA: Tìm "Xe khách Vũ Hán" (tích vàng)<br/>
        📘 Facebook: facebook.com/vuhangroup
      </div>
      <div class="f-copy">Email này được gửi tự động bởi hệ thống Chatbot Nhà xe Vũ Hán. Vui lòng không reply email này.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export class EmailService {
  /**
   * Gửi email xác nhận đặt vé thành công
   * @returns true nếu gửi thành công, false nếu thất bại hoặc chạy ở chế độ debug
   */
  static async sendBookingConfirmation(booking: BookingInfo): Promise<boolean> {
    if (!booking.email) {
      console.warn('[EmailService] Không có email trong booking info, bỏ qua gửi email.');
      return false;
    }

    const transporter = getTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || 'Nhà xe Vũ Hán';
    const fromAddress = process.env.EMAIL_USER || 'noreply@vuhan.com';
    const subject = `✅ Xác nhận đặt vé thành công - ${booking.pickup} → ${booking.dropoff} (${booking.departure_date})`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: booking.email,
      subject,
      html: buildEmailHTML(booking),
      text: `
Xác nhận đặt vé thành công - Nhà xe Vũ Hán
============================================
Khách hàng: ${booking.customer_name}
SĐT: ${booking.phone_number}
Tuyến: ${booking.pickup} → ${booking.dropoff}
Ngày: ${booking.departure_date}
Giờ: ${booking.departure_time}
Loại xe: ${getVehicleLabel(booking.vehicle_type)}
Số vé: ${booking.ticket_count ?? 1}

Thanh toán: Techcombank - 8686111085 - Bùi Thị Minh Hằng
Hotline: 0866.111.085
      `.trim()
    };

    // Chế độ Debug: không có transporter thì chỉ log ra console
    if (!transporter) {
      console.log('\n========== [EmailService] DEBUG MODE ==========');
      console.log(`📧 To: ${booking.email}`);
      console.log(`📌 Subject: ${subject}`);
      console.log(`📋 Booking: ${booking.customer_name} | ${booking.pickup} → ${booking.dropoff} | ${booking.departure_date}`);
      console.log('================================================\n');
      return false;
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Email đã gửi thành công đến ${booking.email}. MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`[EmailService] ❌ Lỗi gửi email đến ${booking.email}:`, error);
      return false;
    }
  }
}
