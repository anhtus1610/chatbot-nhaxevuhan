/**
 * Tool lấy thông tin văn phòng
 */

import { normalizePlace } from '../utils/placeNormalizer';

export interface OfficeInfo {
  name: string;
  address: string;
  phone: string;
  working_hours: string;
  note: string;
}

export interface OfficeResult {
  operator_id: string;
  location: string;
  office: OfficeInfo | null;
  all_offices?: OfficeInfo[];
}

// Dữ liệu văn phòng - sẽ được load từ knowledge files
const offices: { [key: string]: OfficeInfo } = {
  'my_dinh': {
    name: 'Văn phòng Mỹ Đình',
    address: 'N5 A2 Ngõ 1 Nguyễn Hoàng, mặt sau bến xe Mỹ Đình (ô 18 cho tuyến Tuyên Quang)',
    phone: '0912 037 237',
    working_hours: 'Đến 20:00 (nhận hàng đến 18:00)',
    note: 'Cạnh nhà hàng Nhất Quán, đường rộng ô tô vào thoải mái'
  },
  'ha_noi': {
    name: 'Văn phòng Mỹ Đình (Hà Nội)',
    address: 'N5 A2 Ngõ 1 Nguyễn Hoàng, mặt sau bến xe Mỹ Đình',
    phone: '0912 037 237',
    working_hours: 'Đến 20:00 (nhận hàng đến 18:00)',
    note: ''
  },
  'giap_bat': {
    name: 'Văn phòng Giáp Bát',
    address: '757 Giải Phóng',
    phone: '0348 335 885',
    working_hours: 'Nhận hàng đến 17:00',
    note: ''
  },
  'tuyen_quang': {
    name: 'Văn phòng Tuyên Quang',
    address: '95 đường Chiến Thắng Sông Lô, P. Minh Xuân (cửa bến xe TQ)',
    phone: '0372 828 828',
    working_hours: 'Đến 23:00',
    note: ''
  },
  'xin_man': {
    name: 'Văn phòng Xín Mần',
    address: 'Tổ 1 xã Pà Vầy Sủ (khách sạn Huyền An)',
    phone: '',
    working_hours: '',
    note: ''
  },
  'meo_vac': {
    name: 'Văn phòng Mèo Vạc',
    address: 'Tổ 2 thị trấn Mèo Vạc (trên chợ, trên quảng trường)',
    phone: '',
    working_hours: '',
    note: ''
  }
};

export async function getOfficeInfo(
  operatorId: string,
  location: string
): Promise<OfficeResult> {
  const normalizedLocation = normalizePlace(location);
  const office = offices[normalizedLocation.normalized];

  if (office) {
    return {
      operator_id: operatorId,
      location: normalizedLocation.canonical,
      office
    };
  }

  // Trả về tất cả văn phòng nếu không tìm thấy cụ thể
  return {
    operator_id: operatorId,
    location: location,
    office: null,
    all_offices: Object.values(offices)
  };
}
