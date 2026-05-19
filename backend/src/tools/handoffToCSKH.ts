/**
 * Tool chuyển hội thoại sang CSKH
 */

import prisma from '../utils/prisma';

export interface HandoffResult {
  success: boolean;
  reason: string;
  customer_info: any;
  message: string;
  ticket_id?: string;
}

export async function handoffToCSKH(
  reason: string,
  customerInfo?: any
): Promise<HandoffResult> {
  const ticketId = `CSKH-${Date.now()}`;

  // Save to database for admin notification
  try {
    await prisma.cskhRequest.create({
      data: {
        ticket_id: ticketId,
        reason,
        phone: customerInfo?.phone_number || customerInfo?.phone || null,
        name: customerInfo?.customer_name || customerInfo?.name || null,
        sessionId: customerInfo?.session_id || null,
      }
    });
  } catch (err) {
    console.error('[handoffToCSKH] Failed to save CSKH request:', err);
  }

  return {
    success: true,
    reason,
    customer_info: customerInfo || {},
    message: 'Dạ câu hỏi này bên em cần bộ phận chuyên trách hỗ trợ ạ. Anh/chị vui lòng chờ nhân viên tiếp nhận nhé!',
    ticket_id: ticketId
  };
}
