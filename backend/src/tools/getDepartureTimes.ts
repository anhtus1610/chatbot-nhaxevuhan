/**
 * Tool lấy lịch các chuyến xe
 * Dữ liệu từ Markdown Knowledge Store (schedules.md + Q&A)
 * Không còn hardcode baseSchedules — toàn bộ từ Markdown
 */

import { normalizePlace } from '../utils/placeNormalizer';
import { knowledgeService, RouteEntry } from '../services/KnowledgeService';

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
    scheduleEntries.map(s => `${s.time} (${s.vehicle})`));

  // Chuyển đổi ScheduleEntry → DepartureInfo
  let departures: DepartureInfo[] = scheduleEntries.map(s => ({
    time: s.time,
    vehicle_type: s.vehicle.toLowerCase().includes('vip') ? 'limousine' : 'bus',
    vehicle_label: s.vehicle || 'Xe giường',
    eta_destination: '',
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

  // 2. Tìm Q&A từ Markdown cho câu hỏi lịch chạy
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

  // 3. Tìm thông tin lộ trình từ Markdown route
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
