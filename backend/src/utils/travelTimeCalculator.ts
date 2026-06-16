/**
 * Công cụ tính toán và điều chỉnh thời gian di chuyển (Travel Time Calculator)
 */

export const FALLBACK_OFFSETS: { [key: string]: number } = {
  'cau_thang_long': 15,
  'ciputra': 15,
  'cong_vien_hoa_binh': 15,
  'bau': 20,
  'nam_hong': 25,
  'nga_3_kim_anh': 30,
  'nga_4_noi_bai': 30,
  'me_linh': 30,
  'quang_minh': 30,
  'km14': 45,
  'km14_binh_xuyen': 45,
  'km25': 60,
  'km25_tam_dao': 60,
  'km41': 70,
  'phu_tho': 120,
  'tuyen_quang': 130,
  'ha_giang': 420,
  'xin_man': 480,
  'dong_van': 600,
  'meo_vac': 540
};

/**
 * Tính toán thời gian di chuyển cuối cùng dựa trên base, loại xe và giờ xuất phát
 * @param baseMinutes Thời gian chuẩn (phút) cho xe giường nằm giờ bình thường
 * @param vehicleType Loại xe ('limousine' hoặc 'bus')
 * @param departureTime Giờ khởi hành (VD: '05:30', '19:20')
 * @returns số phút di chuyển đã được điều chỉnh
 */
export function applyTimeBasedMultiplier(baseMinutes: number, departureTime: string): number {
  const [hoursStr, minutesStr] = departureTime.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  let multiplier = 1.0;

  if (!isNaN(hours) && !isNaN(minutes)) {
    const timeInMinutes = hours * 60 + minutes;
    
    // Cao điểm sáng: 07:00 - 09:00 (420 - 540)
    // Cao điểm chiều: 17:00 - 20:00 (1020 - 1200)
    const isMorningPeak = timeInMinutes >= 420 && timeInMinutes <= 540;
    const isEveningPeak = timeInMinutes >= 1020 && timeInMinutes <= 1200;
    
    // Giờ đêm: 22:00 - 04:00 (>= 1320 hoặc <= 240)
    const isNight = timeInMinutes >= 1320 || timeInMinutes <= 240;

    if (isMorningPeak || isEveningPeak) {
      multiplier *= 1.20; // Cao điểm đi chậm hơn 20%
    } else if (isNight) {
      multiplier *= 0.90; // Ban đêm đi nhanh hơn 10%
    }
  }

  return Math.round(baseMinutes * multiplier);
}

export function adjustTravelTime(
  baseMinutes: number,
  vehicleType: string,
  departureTime: string
): number {
  let multiplier = 1.0;

  // 1. Hệ số loại xe
  if (vehicleType.toLowerCase() === 'limousine') {
    multiplier *= 0.85; // Limousine đi nhanh hơn 15%
  }

  const vehicleAdjusted = baseMinutes * multiplier;
  
  // 2. Hệ số khung giờ
  return applyTimeBasedMultiplier(vehicleAdjusted, departureTime);
}

/**
 * Lấy thời gian base (phút) cho một điểm đến
 */
export function getBaseMinutesForDestination(destination: string): number {
  const normalizedDest = destination.toLowerCase().replace(/[\s-]/g, '_');
  for (const [key, minutes] of Object.entries(FALLBACK_OFFSETS)) {
    if (normalizedDest.includes(key) || key.includes(normalizedDest)) {
      return minutes;
    }
  }
  return 180; 
}
