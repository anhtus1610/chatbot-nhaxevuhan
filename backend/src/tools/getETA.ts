/**
 * Tool tính thời gian dự kiến (ETA)
 * Lấy dữ liệu từ schedules.md (KnowledgeService) thay vì hardcode
 */

import { normalizePlace } from '../utils/placeNormalizer';
import { knowledgeService } from '../services/KnowledgeService';

export interface ETAResult {
  operator_id: string;
  departure_time: string;
  from: string;
  to: string;
  checkpoint: string;
  eta: string;
  offset_minutes: number;
  travel_time_text: string;
  confidence: string;
  note: string;
}

// Fallback ETA offsets từ Mỹ Đình (phút) — chỉ dùng khi không tìm được từ schedules.md
const fallbackOffsets: { [key: string]: number } = {
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
 * Tìm ETA thực tế từ schedules.md — parse từ bảng ETA chi tiết
 * Ví dụ: xe 05:30 → Tuyên Quang (TP cũ) = 07:40 → offset = 130 phút
 */
function findETAFromSchedules(departureTime: string, checkpoint: string): { eta: string; offset: number } | null {
  const scheduleMd = knowledgeService.getSchedulesMarkdown();
  if (!scheduleMd) return null;

  const normalizedCheckpoint = checkpoint.toLowerCase();

  // Tìm bảng ETA chứa giờ khởi hành này
  // Pattern: "### ETA dự kiến (chiều đi 5h30:" hoặc "### ETA dự kiến (chiều đi Mỹ Đình →"
  const etaSections = scheduleMd.split(/### ETA dự kiến/);

  for (const section of etaSections) {
    // Kiểm tra section có liên quan đến departure time không
    const depTimeNorm = departureTime.replace(':', 'h');
    const depTimeNorm2 = departureTime;
    
    // Tìm giờ khởi hành trong header section
    const headerLine = section.split('\n')[0] || '';
    const headerLower = headerLine.toLowerCase();
    
    // Match "chiều đi 5h30" hoặc "chiều đi Mỹ Đình → Đồng Văn" khi departure=19:30
    const hasMatchingTime = headerLower.includes(depTimeNorm) || 
                            headerLower.includes(depTimeNorm2) ||
                            headerLower.includes(departureTime.replace(':', 'h'));

    if (!hasMatchingTime && !headerLower.includes('chiều đi mỹ đình')) continue;

    // Tìm trong bảng ETA
    const lines = section.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;

      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length < 2) continue;

      const point = cells[0].toLowerCase();
      const timeStr = cells[1].trim();

      // Check if this point matches our checkpoint
      if (point.includes(normalizedCheckpoint) || normalizedCheckpoint.includes(point.replace(/\s*\(.*?\)\s*/g, '').trim())) {
        // Parse time like "07:40", "~23:00", "~04:00+1"
        const timeMatch = timeStr.match(/~?(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const etaHours = parseInt(timeMatch[1]);
          const etaMinutes = parseInt(timeMatch[2]);
          
          // Parse departure time
          const [depH, depM] = departureTime.split(':').map(Number);
          
          let depTotal = depH * 60 + depM;
          let etaTotal = etaHours * 60 + etaMinutes;
          
          // Handle overnight (ETA is next day)
          if (etaTotal < depTotal) etaTotal += 24 * 60;
          
          const offset = etaTotal - depTotal;
          
          return { 
            eta: timeStr.replace(/^~/, '~'),
            offset 
          };
        }
      }
    }
  }

  return null;
}

/**
 * Format thời gian di chuyển thành text dễ đọc
 */
function formatTravelTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins} phút`;
  if (mins === 0) return `${hours} tiếng`;
  return `${hours} tiếng ${mins} phút`;
}

export async function getETA(
  operatorId: string,
  departureTime: string,
  checkpoint: string,
  from?: string,
  to?: string
): Promise<ETAResult> {
  await knowledgeService.init();
  
  const normalizedCheckpoint = normalizePlace(checkpoint);
  
  // 1. Thử tìm ETA thực tế từ schedules.md trước
  const scheduleETA = findETAFromSchedules(departureTime, checkpoint);
  
  let offsetMinutes: number;
  let etaStr: string;
  let confidence: string;
  
  if (scheduleETA) {
    offsetMinutes = scheduleETA.offset;
    etaStr = scheduleETA.eta;
    confidence = 'from_schedule';
    console.log(`[getETA] Found ETA from schedules.md: ${checkpoint} = ${etaStr} (offset: ${offsetMinutes} min)`);
  } else {
    // 2. Fallback: dùng offset cố định
    offsetMinutes = fallbackOffsets[normalizedCheckpoint.normalized] || 0;
    
    // Tính ETA từ offset
    const [hours, minutes] = departureTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes + offsetMinutes;
    
    let etaHours = Math.floor(totalMinutes / 60) % 24;
    let etaMinutes = totalMinutes % 60;
    let dayOffset = Math.floor(totalMinutes / (24 * 60));
    
    etaStr = `~${etaHours.toString().padStart(2, '0')}:${etaMinutes.toString().padStart(2, '0')}${dayOffset > 0 ? '+' + dayOffset : ''}`;
    confidence = 'approximate';
    console.log(`[getETA] Using fallback offset for ${checkpoint}: ${offsetMinutes} min → ${etaStr}`);
  }

  return {
    operator_id: operatorId,
    departure_time: departureTime,
    from: from || 'Mỹ Đình',
    to: to || checkpoint,
    checkpoint: normalizedCheckpoint.canonical,
    eta: etaStr,
    offset_minutes: offsetMinutes,
    travel_time_text: `khoảng ${formatTravelTime(offsetMinutes)}`,
    confidence,
    note: 'Có thể thay đổi theo điều kiện thực tế. Lái phụ xe sẽ xác nhận chính xác.'
  };
}
