/**
 * Tool cung cấp thông tin gửi hàng
 */

import { getOfficeInfo } from './getOfficeInfo';

export interface ShippingResult {
  from_location: string;
  to_location: string;
  instructions: string;
  offices: any[];
  note: string;
}

export async function checkShippingInfo(
  operatorId: string,
  fromLocation: string,
  toLocation: string
): Promise<ShippingResult> {
  // Lấy thông tin văn phòng gần nhất
  const officeResult = await getOfficeInfo(operatorId, fromLocation);
  
  const offices = officeResult.office 
    ? [officeResult.office] 
    : officeResult.all_offices || [];

  return {
    from_location: fromLocation,
    to_location: toLocation,
    instructions: `Dạ anh/chị mang hàng ra văn phòng gần nhất để gửi ạ:
• Văn phòng Mỹ Đình: nhận hàng đến 18:00
• Văn phòng Giáp Bát: nhận hàng đến 17:00

Về cước gửi hàng, anh/chị liên hệ trực tiếp văn phòng để được báo giá chính xác nhé ạ.`,
    offices,
    note: 'Cước gửi hàng tính theo trọng lượng và kích thước, cần xem hàng trực tiếp để báo giá.'
  };
}
