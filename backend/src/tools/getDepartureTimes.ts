/**
 * Tool lấy lịch các chuyến xe
 * Dữ liệu từ Markdown Knowledge Store (schedules.md + Q&A)
 * Không còn hardcode baseSchedules — toàn bộ từ Markdown
 */

import { normalizePlace } from '../utils/placeNormalizer';
import { knowledgeService, RouteEntry, ScheduleEntry } from '../services/KnowledgeService';

export interface DepartureInfo {
  time: string;
  vehicle_type: string;
  vehicle_label: string;
  eta_destination: string;
  note: string;
}

export interface DepartureResult {
  operator_id: string;
  from: string;
  to: string;
  departures: DepartureInfo[];
  source: string;
  qa_response?: string;        // Câu trả lời từ Q&A Markdown — AI PHẢI dùng cái này khi departures rỗng
  route_info?: string;         // Thông tin lộ trình từ Markdown
  has_direct_answer: boolean;  // Cho AI biết có câu trả lời sẵn không
}

/**
 * Tính thời gian di chuyển (phút) từ chuyến đối lưu.
 * Lấy trung bình travel time của các chuyến cùng loại xe theo chiều ngược lại.
 */
function getTravelTimeFromReverseRoute(
  reverseEntries: ScheduleEntry[],
  vehicleType: string
): number | null {
  const sameTypeEntries = reverseEntries.filter(s => {
    const isVip = s.vehicle.toLowerCase().includes('vip');
    return vehicleType === 'limousine' ? isVip : !isVip;
  });

  const withEta = sameTypeEntries.filter(s => s.eta);
  if (withEta.length === 0) return null;

  // Tính travel time (phút) của từng chuyến có ETA
  const travelTimes: number[] = [];
  for (const entry of withEta) {
    const etaStr = entry.eta!.replace(/^~/, '').replace(/\s*\(hôm sau\)/, '');
    const [etaH, etaM] = etaStr.split(':').map(Number);
    const [depH, depM] = entry.time.split(':').map(Number);

    if (isNaN(etaH) || isNaN(etaM) || isNaN(depH) || isNaN(depM)) continue;

    let depTotal = depH * 60 + depM;
    let etaTotal = etaH * 60 + etaM;
    if (etaTotal <= depTotal) etaTotal += 24 * 60; // qua ngày

    travelTimes.push(etaTotal - depTotal);
  }

  if (travelTimes.length === 0) return null;

  // Trả về trung bình
  return Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length);
}

/**
 * Tính ETA string từ departure time + travel minutes
 */
function calcETA(departureTime: string, travelMinutes: number): string {
  const [h, m] = departureTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const totalMin = h * 60 + m + travelMinutes;
  const etaH = Math.floor(totalMin / 60) % 24;
  const etaM = totalMin % 60;
  const dayOff = Math.floor(totalMin / (24 * 60));
  return `~${etaH.toString().padStart(2, '0')}:${etaM.toString().padStart(2, '0')}${dayOff > 0 ? ' (hôm sau)' : ''}`;
}

export async function getDepartureTimes(
  operatorId: string,
  from: string,
  to: string,
  vehicle?: string,
  date?: string
): Promise<DepartureResult> {
  await knowledgeService.init();

  const normalizedFrom = normalizePlace(from);
  const normalizedTo = normalizePlace(to);

  console.log(`[getDepartureTimes] Looking for: ${normalizedFrom.canonical} → ${normalizedTo.canonical}`);

  const expandLocations = (loc: string): string[] => {
    const locLower = loc.toLowerCase();
    const provinceMap: Record<string, string[]> = {
      'hà giang': ['hà giang', 'tp hà giang', 'đồng văn', 'mèo vạc', 'xín mần', 'hoàng su phì', 'quản bạ', 'yên minh', 'mậu duệ', 'bắc mê', 'vị xuyên', 'bắc quang', 'tân quang'],
      'tuyên quang': ['tuyên quang', 'tp tuyên quang', 'na hang', 'chiêm hoá', 'hàm yên', 'sơn phú', 'đà vị', 'kiến thiết', 'mỹ bằng', 'xuân vân', 'trung trực'],
      'cao bằng': ['cao bằng', 'tp cao bằng', 'bảo lâm', 'lý bôn', 'thượng nông', 'thượng giáp', 'đường âm', 'đường hồng', 'yên hoa'],
      'lào cai': ['lào cai', 'tp lào cai', 'bắc hà', 'bảo nhai', 'lu', 'phố lu', 'bảo hà'],
    };
    
    // Chỉ expand nếu loc trùng khớp chính xác tên tỉnh (hoặc "tp <tỉnh>")
    for (const [prov, areas] of Object.entries(provinceMap)) {
      if (locLower === prov || locLower === `tp ${prov}`) {
        return areas;
      }
    }
    return [loc];
  };

  const fromLocations = expandLocations(normalizedFrom.canonical);
  const toLocations = expandLocations(normalizedTo.canonical);

  const isProvinceSearch = fromLocations.length > 1 || toLocations.length > 1;

  // 1. Tìm lịch từ KnowledgeService (parsed từ schedules.md)
  let scheduleEntries: ScheduleEntry[] = [];
  let reverseEntries: ScheduleEntry[] = [];

  for (const fLoc of fromLocations) {
    for (const tLoc of toLocations) {
      scheduleEntries.push(...knowledgeService.findSchedules(fLoc, tLoc));
      reverseEntries.push(...knowledgeService.findReverseSchedules(fLoc, tLoc));
    }
  }

  console.log(`[getDepartureTimes] Found ${scheduleEntries.length} schedule entries after expansion`);

  // Tính travel time từ chiều ngược (theo loại xe)
  const vipTravelFromReverse = getTravelTimeFromReverseRoute(reverseEntries, 'limousine');
  const busTravelFromReverse = getTravelTimeFromReverseRoute(reverseEntries, 'bus');

  console.log(`[getDepartureTimes] Travel time inferred from reverse: VIP=${vipTravelFromReverse ?? 'N/A'}min, Bus=${busTravelFromReverse ?? 'N/A'}min`);

  // Chuyển đổi ScheduleEntry → DepartureInfo
  let departures: DepartureInfo[] = scheduleEntries.map(s => {
    // Nếu tìm kiếm theo mảng (chọn tỉnh), thêm điểm đến vào label để phân biệt
    const routeSuffix = isProvinceSearch ? ` (đi ${s.to})` : '';
    return {
      time: s.time,
      vehicle_type: s.vehicle.toLowerCase().includes('vip') ? 'limousine' : 'bus',
      vehicle_label: (s.vehicle || 'Xe giường') + routeSuffix,
      eta_destination: s.eta || '',
      note: s.note || '',
    };
  });

  // Lọc theo loại xe nếu có
  if (vehicle && vehicle !== 'all') {
    departures = departures.filter(d => d.vehicle_type === vehicle);
  }

  // Loại bỏ trùng lặp giờ
  const seen = new Set<string>();
  departures = departures.filter(d => {
    // Dùng vehicle_label thay vì vehicle_type để giữ lại các chuyến cùng giờ nhưng khác đích đến
    const key = d.time + '|' + d.vehicle_label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sắp xếp theo giờ
  departures.sort((a, b) => a.time.localeCompare(b.time));

  // 3. Điền ETA cho các chuyến chưa có
  for (const dep of departures) {
    if (dep.eta_destination) continue; // Đã có ETA từ dữ liệu → bỏ qua

    // Thử lấy travel time từ chiều ngược trước
    const travelFromReverse = dep.vehicle_type === 'limousine'
      ? vipTravelFromReverse
      : busTravelFromReverse;

    if (travelFromReverse !== null) {
      // Dùng travel time từ chiều ngược, NHƯNG phải tính thêm khung giờ (cao điểm/đêm)
      const { applyTimeBasedMultiplier } = require('../utils/travelTimeCalculator');
      const timeAdjusted = applyTimeBasedMultiplier(travelFromReverse, dep.time);
      
      dep.eta_destination = calcETA(dep.time, timeAdjusted);
      dep.note = dep.note || `Ước tính dựa trên hành trình chiều ngược (~${Math.round(timeAdjusted / 60)} tiếng)`;
      console.log(`[getDepartureTimes] Inferred ETA for ${dep.time} (${dep.vehicle_label}): ${dep.eta_destination} from reverse route`);
    } else {
      // Fallback cuối cùng: dùng travelTimeCalculator
      const { getBaseMinutesForDestination, adjustTravelTime } = require('../utils/travelTimeCalculator');
      const baseMinutes = getBaseMinutesForDestination(normalizedTo.canonical);
      const adjustedMinutes = adjustTravelTime(baseMinutes, dep.vehicle_type, dep.time);
      
      dep.eta_destination = calcETA(dep.time, adjustedMinutes);
      dep.note = dep.note || `Ước tính ~${Math.round(adjustedMinutes / 60)} tiếng`;
    }
  }

  // Helper to find the first occurrence of a place name or its aliases in a string
  const getFirstOccurrence = (place: string, text: string): number => {
    const normalizedPlace = place.toLowerCase().trim();
    const aliases: Record<string, string[]> = {
      'xín mần': ['cốc pài', 'pà vầy sủ'],
      'bảo lâm': ['pắc mầu'],
      'hà nội': ['mỹ đình', 'hn', 'mỹđình'],
      'đồng văn': ['đv'],
      'mèo vạc': ['mv'],
      'tuyên quang': ['tq'],
      'hà giang': ['hg'],
      'hoàng su phì': ['vinh quang', 'su phì'],
      'quản bạ': ['tam sơn', 'quyết tiến'],
      'chiêm hoá': ['vĩnh lộc'],
    };

    let terms = [normalizedPlace];
    for (const [key, values] of Object.entries(aliases)) {
      if (
        normalizedPlace.includes(key) || 
        key.includes(normalizedPlace) || 
        values.some(v => normalizedPlace.includes(v) || v.includes(normalizedPlace))
      ) {
        terms.push(key, ...values);
      }
    }

    terms = Array.from(new Set(terms)).filter(t => t.length > 1);

    let minIdx = -1;
    for (const term of terms) {
      const idx = text.indexOf(term);
      if (idx !== -1 && (minIdx === -1 || idx < minIdx)) {
        minIdx = idx;
      }
    }
    return minIdx;
  };

  // 4. Tìm Q&A từ Markdown cho câu hỏi lịch chạy
  const queries = [
    `${from} ${to} mấy giờ`,
    `${from} đi ${to}`,
    `${from} đến ${to}`,
    `${from} ${to} chuyến`,
    `${from} ${to}`,
  ];

  let qaResponse: string | undefined;

  for (const query of queries) {
    const matches = knowledgeService.searchQA(query, 10);

    const scheduleMatch = matches.find(qa => {
      const qLower = qa.question.toLowerCase();
      const isTimeQuery = qLower.includes('mấy giờ') || qLower.includes('chuyến') || qLower.includes('giờ');
      
      // Bắt buộc câu hỏi trong Q&A phải chứa địa danh (trừ Hà Nội là trạm chung)
      // Điều này ngăn chặn việc hỏi "Hà Giang" nhưng lại match trúng "Hà Nội đi Đồng Văn"
      const fromLower = from.toLowerCase();
      const toLower = to.toLowerCase();
      
      if (fromLower && fromLower !== 'hà nội' && !qLower.includes(fromLower)) return false;
      if (toLower && toLower !== 'hà nội' && !qLower.includes(toLower)) return false;

      // Kiểm tra chiều di chuyển (hướng đi): từ điểm đi đến điểm đến
      const idxFrom = getFirstOccurrence(from, qLower);
      const idxTo = getFirstOccurrence(to, qLower);
      if (idxFrom !== -1 && idxTo !== -1 && idxFrom > idxTo) {
        // Điểm đi đứng sau điểm đến => Ngược chiều
        return false;
      }
      
      // Ngăn chặn "Hà Nội đi Phú Thọ" match trúng "Tuyên Quang đi Phú Thọ"
      // Nếu query gốc có Hà Nội, nhưng câu hỏi Q&A KHÔNG chứa Hà Nội (vì đã bị skip ở trên),
      // thì phải kiểm tra xem câu hỏi Q&A có chứa điểm xuất phát chính nào khác không. Nếu có -> Loại.
      const otherOrigins = ['tuyên quang', 'bắc giang', 'bắc ninh', 'đoan hùng', 'hà giang', 'chiêm hoá', 'mèo vạc', 'xín mần', 'hoàng su phì'];
      if (fromLower === 'hà nội' && idxFrom === -1) {
         if (otherOrigins.some(o => qLower.includes(o))) return false;
      }
      if (toLower === 'hà nội' && idxTo === -1) {
         if (otherOrigins.some(o => qLower.includes(o))) return false;
      }

      return isTimeQuery;
    });

    if (scheduleMatch && !qaResponse) {
      qaResponse = scheduleMatch.answer;
    }

    if (qaResponse) break;
  }

  // 5. Tìm thông tin lộ trình từ Markdown route
  const routeMatches: RouteEntry[] = knowledgeService.searchRoutes(`${from} ${to}`);
  const routeInfo = routeMatches.length > 0 ? routeMatches[0].content : undefined;

  // Ưu tiên sử dụng qaResponse nếu đã tìm thấy (vì nó cực kỳ chính xác)
  // Chỉ dùng routeInfo nếu qaResponse bị rỗng
  if (!qaResponse && routeInfo && !departures.length) {
    qaResponse = routeInfo;
  }

  const hasDirectAnswer = departures.length > 0 || !!qaResponse;

  return {
    operator_id: operatorId,
    from: normalizedFrom.canonical,
    to: normalizedTo.canonical,
    departures,
    source: departures.length > 0 ? 'markdown_schedule' : (routeInfo ? 'markdown_route' : (qaResponse ? 'markdown_qa' : 'not_found')),
    qa_response: qaResponse,
    route_info: routeInfo,
    has_direct_answer: hasDirectAnswer,
  };
}
