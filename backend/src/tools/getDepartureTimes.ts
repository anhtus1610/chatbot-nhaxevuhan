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

  // 1. Tìm lịch từ KnowledgeService (parsed từ schedules.md)
  let scheduleEntries = knowledgeService.findSchedules(
    normalizedFrom.canonical,
    normalizedTo.canonical
  );

  console.log(`[getDepartureTimes] Found ${scheduleEntries.length} schedule entries:`,
    scheduleEntries.map(s => `${s.time} (${s.vehicle}) eta=${s.eta || 'N/A'}`));

  // 2. Tìm chuyến chiều NGƯỢC để tính travel time cho các chuyến chưa có ETA
  const reverseEntries = knowledgeService.findReverseSchedules(
    normalizedFrom.canonical,
    normalizedTo.canonical
  );

  // Tính travel time từ chiều ngược (theo loại xe)
  const vipTravelFromReverse = getTravelTimeFromReverseRoute(reverseEntries, 'limousine');
  const busTravelFromReverse = getTravelTimeFromReverseRoute(reverseEntries, 'bus');

  console.log(`[getDepartureTimes] Travel time inferred from reverse: VIP=${vipTravelFromReverse ?? 'N/A'}min, Bus=${busTravelFromReverse ?? 'N/A'}min`);

  // Chuyển đổi ScheduleEntry → DepartureInfo
  let departures: DepartureInfo[] = scheduleEntries.map(s => ({
    time: s.time,
    vehicle_type: s.vehicle.toLowerCase().includes('vip') ? 'limousine' : 'bus',
    vehicle_label: s.vehicle || 'Xe giường',
    eta_destination: s.eta || '',
    note: s.note || '',
  }));

  // Lọc theo loại xe nếu có
  if (vehicle && vehicle !== 'all') {
    departures = departures.filter(d => d.vehicle_type === vehicle);
  }

  // Loại bỏ trùng lặp giờ
  const seen = new Set<string>();
  departures = departures.filter(d => {
    const key = d.time + '|' + d.vehicle_type;
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
      // Dùng travel time từ chiều ngược
      dep.eta_destination = calcETA(dep.time, travelFromReverse);
      dep.note = dep.note || `Ước tính dựa trên hành trình chiều ngược (~${Math.round(travelFromReverse / 60)} tiếng)`;
      console.log(`[getDepartureTimes] Inferred ETA for ${dep.time} (${dep.vehicle_label}): ${dep.eta_destination} from reverse route`);
    } else {
      // Fallback cuối cùng: hardcode theo loại xe
      const fallbackMinutes = dep.vehicle_type === 'limousine' ? 120 : 180;
      dep.eta_destination = calcETA(dep.time, fallbackMinutes);
      dep.note = dep.note || `Ước tính ~${Math.round(fallbackMinutes / 60)} tiếng`;
    }
  }

  // 4. Tìm Q&A từ Markdown cho câu hỏi lịch chạy
  const queries = [
    `${from} ${to} mấy giờ`,
    `${to} ${from} mấy giờ`,
    `${from} đi ${to}`,
    `${to} về ${from}`,
    `${from} ${to} chuyến`,
    `${from} ${to}`,
  ];

  let qaResponse: string | undefined;

  for (const query of queries) {
    const matches = knowledgeService.searchQA(query, 10);

    // Ưu tiên câu hỏi có chứa từ "mấy giờ" hoặc "chuyến"
    const scheduleMatch = matches.find(qa =>
      qa.question.toLowerCase().includes('mấy giờ') ||
      qa.question.toLowerCase().includes('chuyến') ||
      qa.question.toLowerCase().includes('giờ')
    );

    if (scheduleMatch && !qaResponse) {
      qaResponse = scheduleMatch.answer;
    }

    if (qaResponse) break;
  }

  // 5. Tìm thông tin lộ trình từ Markdown route
  const routeMatches: RouteEntry[] = knowledgeService.searchRoutes(`${from} ${to}`);
  const routeInfo = routeMatches.length > 0 ? routeMatches[0].content : undefined;

  const hasDirectAnswer = departures.length > 0 || !!qaResponse;

  return {
    operator_id: operatorId,
    from: normalizedFrom.canonical,
    to: normalizedTo.canonical,
    departures,
    source: departures.length > 0 ? 'markdown_schedule' : (qaResponse ? 'markdown_qa' : 'not_found'),
    qa_response: qaResponse,
    route_info: routeInfo,
    has_direct_answer: hasDirectAnswer,
  };
}
