/**
 * Tool kiểm tra điểm đón/trả và lấy giá vé
 * Sử dụng Knowledge Service với 7,796 mức giá từ file Excel
 */

import { normalizePlace } from '../utils/placeNormalizer';
import { knowledgeService } from '../services/KnowledgeService';

export interface RouteCheckResult {
  operator_id: string;
  vehicle: string;
  pickup: {
    status: 'covered' | 'covered_with_fee' | 'limited_point' | 'outside' | 'uncertain';
    suggested_point: string;
    fee_note: string;
    confidence: number;
  };
  dropoff: {
    status: 'covered' | 'covered_with_fee' | 'limited_point' | 'outside' | 'uncertain';
    suggested_point: string;
    fee_note: string;
    confidence: number;
  };
  ticket_fee: {
    amount_k: number;
    amount_vnd: number;
    unit: string;
    currency: string;
    from_stop: string;
    to_stop: string;
    vehicle_type?: string;
  } | null;
  all_prices?: Array<{
    amount_k: number;
    vehicle: string;
    from: string;
    to: string;
  }>;
  overall_response: string;
  validity: {
    pickup_valid: boolean;
    dropoff_valid: boolean;
    all_valid: boolean;
  };
  ambiguous_location?: string;
  suggestions?: string[];
}

// Điểm đặc biệt cần xử lý
const specialLocations: { [key: string]: any } = {
  'ha_giang': {
    type: 'ambiguous',
    message: 'Anh/chị muốn đến khu vực nào của Hà Giang ạ?',
    options: ['Xín Mần', 'Đồng Văn', 'TP Hà Giang']
  },
  'vinh_phuc': {
    type: 'limited',
    message: 'Xe đi cao tốc nên anh/chị ra nút giao nhé ạ',
    options: ['KM14 Bình Xuyên', 'KM25 (Tam Đảo)', 'KM41']
  },
  'tp_lao_cai': {
    type: 'outside',
    message: 'Xe không vào TP Lào Cai ạ',
    suggested: 'Lu'
  },
  'tp_cao_bang': {
    type: 'outside', 
    message: 'Xe chỉ đến Bảo Lâm, không qua TP Cao Bằng ạ',
    suggested: 'Bảo Lâm'
  }
};

export async function checkRouteAndPrice(
  operatorId: string,
  pickup: string,
  dropoff: string,
  vehicle: string = 'bus'
): Promise<RouteCheckResult> {
  // Đảm bảo Knowledge Service đã khởi tạo
  await knowledgeService.init();

  // Chuẩn hóa địa điểm
  const normalizedPickup = normalizePlace(pickup);
  const normalizedDropoff = normalizePlace(dropoff);

  // Kiểm tra điểm đặc biệt
  const pickupSpecial = checkSpecialLocation(normalizedPickup.normalized);
  const dropoffSpecial = checkSpecialLocation(normalizedDropoff.normalized);

  // Nếu điểm mơ hồ (như "Hà Giang")
  if (dropoffSpecial?.type === 'ambiguous') {
    return {
      operator_id: operatorId,
      vehicle,
      pickup: {
        status: 'covered',
        suggested_point: normalizedPickup.canonical,
        fee_note: '',
        confidence: normalizedPickup.score
      },
      dropoff: {
        status: 'uncertain',
        suggested_point: dropoff,
        fee_note: dropoffSpecial.message,
        confidence: 0.5
      },
      ticket_fee: null,
      overall_response: dropoffSpecial.message,
      validity: {
        pickup_valid: true,
        dropoff_valid: false,
        all_valid: false
      },
      ambiguous_location: dropoff,
      suggestions: dropoffSpecial.options
    };
  }

  // Tìm giá vé từ Knowledge Service (7,796 mức giá)
  const priceEntries = knowledgeService.findPrice(
    normalizedPickup.canonical,
    normalizedDropoff.canonical
  );

  // Lấy giá theo loại xe
  let matchedPrice = priceEntries.find(p => {
    const pVehicle = p.vehicle.toLowerCase();
    if (vehicle === 'bus' && (pVehicle.includes('giường') || pVehicle.includes('ghế'))) return true;
    if (vehicle === 'limousine' && pVehicle.includes('vip')) return true;
    return false;
  });

  // Nếu không tìm thấy theo loại xe, lấy giá đầu tiên
  if (!matchedPrice && priceEntries.length > 0) {
    matchedPrice = priceEntries[0];
  }

  // Kiểm tra điểm ngoài vùng phục vụ
  if (dropoffSpecial?.type === 'outside') {
    return {
      operator_id: operatorId,
      vehicle,
      pickup: {
        status: 'covered',
        suggested_point: normalizedPickup.canonical,
        fee_note: '',
        confidence: normalizedPickup.score
      },
      dropoff: {
        status: 'outside',
        suggested_point: dropoffSpecial.suggested,
        fee_note: dropoffSpecial.message,
        confidence: 0.9
      },
      ticket_fee: null,
      overall_response: `${dropoffSpecial.message}. Gợi ý: ${dropoffSpecial.suggested}`,
      validity: {
        pickup_valid: true,
        dropoff_valid: false,
        all_valid: false
      },
      suggestions: [dropoffSpecial.suggested]
    };
  }

  // Trả kết quả
  const result: RouteCheckResult = {
    operator_id: operatorId,
    vehicle,
    pickup: {
      status: 'covered',
      suggested_point: normalizedPickup.canonical,
      fee_note: '',
      confidence: normalizedPickup.score
    },
    dropoff: {
      status: matchedPrice ? 'covered' : 'uncertain',
      suggested_point: normalizedDropoff.canonical,
      fee_note: dropoffSpecial?.type === 'limited' ? dropoffSpecial.message : '',
      confidence: normalizedDropoff.score
    },
    ticket_fee: matchedPrice ? {
      amount_k: matchedPrice.price,
      amount_vnd: matchedPrice.price * 1000,
      unit: 'k',
      currency: 'VND',
      from_stop: matchedPrice.from,
      to_stop: matchedPrice.to,
      vehicle_type: matchedPrice.vehicle
    } : null,
    all_prices: priceEntries.map(p => ({
      amount_k: p.price,
      vehicle: p.vehicle,
      from: p.from,
      to: p.to
    })),
    overall_response: matchedPrice 
      ? `Dạ tuyến ${matchedPrice.from} → ${matchedPrice.to} giá vé ${matchedPrice.price}k (${matchedPrice.vehicle}) ạ.`
      : `Dạ em chưa có thông tin giá vé tuyến này. Anh/chị để lại SĐT để bên em liên hệ nhé ạ.`,
    validity: {
      pickup_valid: true,
      dropoff_valid: !!matchedPrice,
      all_valid: !!matchedPrice
    }
  };

  if (dropoffSpecial?.type === 'limited') {
    result.suggestions = dropoffSpecial.options;
  }

  return result;
}

function checkSpecialLocation(normalizedName: string): any {
  return specialLocations[normalizedName];
}
