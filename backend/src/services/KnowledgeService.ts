import * as fs from 'fs';
import * as path from 'path';

// Types
export interface PriceEntry {
  route: string;
  from: string;
  to: string;
  price: number;
  vehicle: string;
}

export interface QAEntry {
  question: string;
  answer: string;
  source?: string; // 'md' | 'json'
}

export interface ScheduleEntry {
  from: string;
  to: string;
  time: string;
  vehicle: string;
  note: string;
  eta?: string; // ETA dự kiến tới điểm đến, VD: "~07:30"
}

export interface RouteEntry {
  name: string;
  content: string;
  phone?: string;
}

// Knowledge store: Tất cả dữ liệu từ Markdown
class KnowledgeService {
  private prices: PriceEntry[] = [];
  private qaPairs: QAEntry[] = [];
  private schedules: ScheduleEntry[] = [];
  private routes: RouteEntry[] = [];
  private schedulesMarkdown: string = ''; // Raw schedule MD cho AI context
  private initialized = false;

  // Đường dẫn gốc tới Knowledge Store dạng Markdown
  private readonly mdStorePath = path.join(__dirname, '../../knowledge/operators/vu_han');

  // Chuẩn hóa tên địa điểm để so sánh
  private normalizeLocation(loc: string): string {
    if (!loc) return '';
    return loc
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\/\-\(\)]/g, ' ')
      .replace(/tp\s*cũ/g, '')
      .replace(/thị trấn/g, '')
      .trim();
  }

  // So khớp tên địa điểm (fuzzy match + alias)
  private locationsMatch(loc1: string, loc2: string): boolean {
    const n1 = this.normalizeLocation(loc1);
    const n2 = this.normalizeLocation(loc2);

    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;

    const aliases: Record<string, string[]> = {
      'xín mần': ['cốc pài', 'pà vầy sủ'],
      'bảo lâm': ['pắc mầu'],
      'hà nội': ['mỹ đình', 'hn'],
      'đồng văn': ['đv'],
      'mèo vạc': ['mv'],
      'tuyên quang': ['tq'],
      'hà giang': ['hg'],
      'hoàng su phì': ['vinh quang', 'su phì'],
      'quản bạ': ['tam sơn', 'quyết tiến'],
      'chiêm hoá': ['vĩnh lộc'],
    };

    for (const [key, values] of Object.entries(aliases)) {
      if (
        (n1.includes(key) || values.some(v => n1.includes(v))) &&
        (n2.includes(key) || values.some(v => n2.includes(v)))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse Markdown FAQ (format: ### Câu hỏi\nCâu trả lời\n\n...)
   */
  private parseFAQMarkdown(content: string): QAEntry[] {
    const entries: QAEntry[] = [];
    const sections = content.split(/^###\s+/m);

    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.split('\n');
      const question = lines[0]?.trim().replace(/\?$/, '').trim();
      const answerLines = lines
        .slice(1)
        .map(l => l.trim())
        .filter(l => l.length > 0);
      const answer = answerLines.join(' ').trim();

      if (question && answer) {
        entries.push({ question, answer, source: 'md' });
      }
    }

    return entries;
  }

  /**
   * Parse Markdown Route (format: ## Tên tuyến\nnội dung...\n\n...)
   */
  private parseRouteMarkdown(content: string): RouteEntry[] {
    const entries: RouteEntry[] = [];
    const sections = content.split(/^##\s+/m);

    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.split('\n');
      const name = lines[0]?.trim();
      const body = lines.slice(1).join('\n').trim();

      if (name && body) {
        const phoneMatch = body.match(/SĐT xe:\s*([\d\s,và]+)/);
        entries.push({
          name,
          content: body,
          phone: phoneMatch ? phoneMatch[1].trim() : undefined,
        });
      }
    }

    return entries;
  }

  /**
   * Parse Markdown price table → PriceEntry[]
   * Format:
   *   # Bảng giá vé: ... (ROUTE_CODE)
   *   ## Xe giường 40 chỗ
   *   | Điểm đi | Điểm đến | Giá (k) |
   *   |---------|----------|---------|
   *   | Hà Nội  | Đồng Văn | 450     |
   */
  private parseMarkdownPriceTable(content: string, filename: string): PriceEntry[] {
    const entries: PriceEntry[] = [];
    
    // Extract route code from title line: # Bảng giá vé: ... (HN-ĐV)
    const titleMatch = content.match(/^#\s+.*\(([^)]+)\)/m);
    const routeCode = titleMatch ? titleMatch[1] : filename.replace('.md', '').toUpperCase();
    
    // Split by ## to get vehicle sections
    const sections = content.split(/^##\s+/m);
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const vehicleType = lines[0]?.trim();
      
      // Skip non-vehicle sections (like the title)
      if (!vehicleType || vehicleType.startsWith('#') || vehicleType.startsWith('>')) continue;
      
      // Find markdown table rows (skip header row and separator)
      let inTable = false;
      let headerSkipped = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect table start
        if (trimmed.startsWith('| Điểm đi') || trimmed.startsWith('|Điểm đi')) {
          inTable = true;
          headerSkipped = false;
          continue;
        }
        
        // Skip separator row (|---|---|---|)
        if (inTable && !headerSkipped && trimmed.match(/^\|[-:\s|]+\|$/)) {
          headerSkipped = true;
          continue;
        }
        
        // Parse data rows
        if (inTable && headerSkipped && trimmed.startsWith('|')) {
          const cells = trimmed
            .split('|')
            .map(c => c.trim())
            .filter(c => c.length > 0);
          
          if (cells.length >= 3) {
            const from = cells[0];
            const to = cells[1];
            const priceStr = cells[2].replace(/[^\d.]/g, '');
            const price = parseFloat(priceStr);
            
            if (from && to && !isNaN(price) && price > 0) {
              entries.push({
                route: routeCode,
                from,
                to,
                price,
                vehicle: vehicleType,
              });
            }
          }
        }
        
        // End of table
        if (inTable && headerSkipped && !trimmed.startsWith('|') && trimmed.length > 0) {
          inTable = false;
        }
      }
    }
    
    return entries;
  }

  /**
   * Parse Markdown schedule → ScheduleEntry[]
   * Parses the summary table at the end of schedules.md
   */
  private parseMarkdownSchedule(content: string): ScheduleEntry[] {
    const entries: ScheduleEntry[] = [];
    
    // Parse the summary section "Tóm tắt tất cả giờ khởi hành từ Hà Nội"
    const summaryMatch = content.match(/## Tóm tắt tất cả giờ khởi hành[\s\S]*?(?=\n---|\n## Lịch xe|$)/);
    if (summaryMatch) {
      const lines = summaryMatch[0].split('\n');
      let inTable = false;
      let headerSkipped = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('| Tuyến chính')) {
          inTable = true;
          headerSkipped = false;
          continue;
        }
        
        if (inTable && !headerSkipped && trimmed.match(/^\|[-:\s|]+\|$/)) {
          headerSkipped = true;
          continue;
        }
        
        if (inTable && headerSkipped && trimmed.startsWith('|')) {
          const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
          if (cells.length >= 3) {
            const routeStr = cells[0]; // e.g., "Hà Nội → Xín Mần"
            const times = cells[1];     // e.g., "05:30, 10:00, 19:20"
            const vehicleStr = cells[2]; // e.g., "VIP (5:30), Giường (10:00, 19:20)"
            
            // Parse route
            const routeParts = routeStr.split(/→|↔/).map(s => s.trim());
            const from = routeParts[0] || '';
            const to = routeParts[1] || '';
            
            // Parse times
            const timeList = times.split(',').map(t => t.trim()).filter(t => t.match(/\d/));
            
            // Build a map of time → vehicle from format like "VIP (5:30), Giường (10:00, 19:20)"
            const timeVehicleMap: Record<string, string> = {};
            const vehicleParts = vehicleStr.match(/([^,()]+)\s*\(([^)]+)\)/g);
            if (vehicleParts) {
              for (const part of vehicleParts) {
                const m = part.match(/([^(]+)\s*\(([^)]+)\)/);
                if (m) {
                  const vLabel = m[1].trim();
                  const vTimes = m[2].split(',').map(t => t.trim());
                  let resolvedVehicle = vLabel;
                  if (vLabel.toLowerCase().includes('vip')) resolvedVehicle = 'VIP 9 chỗ';
                  else if (vLabel.toLowerCase().includes('giường')) resolvedVehicle = 'Giường 40 chỗ';
                  else if (vLabel.toLowerCase().includes('ghế')) resolvedVehicle = 'Ghế';
                  for (const vt of vTimes) {
                    timeVehicleMap[vt] = resolvedVehicle;
                  }
                }
              }
            }
            
            for (const time of timeList) {
              // Determine vehicle type for this time
              let vehicle = timeVehicleMap[time] || '';
              if (!vehicle) {
                // Fallback: simple matching
                if (vehicleStr.includes('VIP') && !vehicleStr.includes('(')) {
                  vehicle = 'VIP 9 chỗ';
                } else if (vehicleStr.includes('Giường') && !vehicleStr.includes('(')) {
                  vehicle = 'Giường 40 chỗ';
                } else if (vehicleStr.includes('Ghế')) {
                  vehicle = 'Ghế';
                } else {
                  vehicle = vehicleStr;
                }
              }
              
              entries.push({
                from,
                to,
                time: time.replace(/[()]/g, ''),
                vehicle,
                note: '',
              });
            }
          }
        }
        
        if (inTable && headerSkipped && !trimmed.startsWith('|') && trimmed.length > 0) {
          inTable = false;
        }
      }
    }
    
    // Also parse per-route detailed tables ("Giờ đi từ X → Y" and "Giờ về từ X → Y")
    // These have format: | Giờ KH | Loại xe | Ghi chú | and contain ETA in notes
    const detailSections = content.match(/### Giờ (đi|về) từ [\s\S]*?(?=\n###|\n---|$)/g);
    if (detailSections) {
      for (const section of detailSections) {
        const headerMatch = section.match(/### Giờ (?:đi|về) từ (.+?)\s*(?:\(|$)/m);
        if (!headerMatch) continue;
        
        const routeStr = headerMatch[1].trim();
        const routeParts = routeStr.split(/→|↔/).map(s => s.trim());
        const detailFrom = routeParts[0] || '';
        const detailTo = routeParts[1] || '';
        
        if (!detailFrom || !detailTo) continue;
        
        const lines = section.split('\n');
        let inTable = false;
        let headerSkipped = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('| Giờ KH') || trimmed.startsWith('|Giờ KH')) {
            inTable = true;
            headerSkipped = false;
            continue;
          }
          
          if (inTable && !headerSkipped && trimmed.match(/^\|[-:\s|]+\|$/)) {
            headerSkipped = true;
            continue;
          }
          
          if (inTable && headerSkipped && trimmed.startsWith('|')) {
            const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
            if (cells.length >= 2) {
              const timeVal = cells[0].trim();
              const vehicleVal = cells[1].trim();
              const noteVal = cells[2] || '';
              
              // Extract ETA from note like "Đến TQ ~07:30" or "Sớm nhất, đến TQ ~07:30"
              const etaMatch = noteVal.match(/~?(\d{1,2}:\d{2})/);
              const etaVal = etaMatch ? `~${etaMatch[1]}` : undefined;
              
              // Check if this entry already exists (from summary table)
              const existingIdx = entries.findIndex(e => 
                e.time === timeVal && 
                this.locationsMatch(e.from, detailFrom) && 
                this.locationsMatch(e.to, detailTo)
              );
              
              if (existingIdx >= 0) {
                // Update existing entry with ETA and better vehicle info
                if (etaVal) entries[existingIdx].eta = etaVal;
                if (vehicleVal) entries[existingIdx].vehicle = vehicleVal;
                if (noteVal) entries[existingIdx].note = noteVal;
              } else {
                // Add new entry
                entries.push({
                  from: detailFrom,
                  to: detailTo,
                  time: timeVal,
                  vehicle: vehicleVal,
                  note: noteVal,
                  eta: etaVal,
                });
              }
            }
          }
          
          if (inTable && headerSkipped && !trimmed.startsWith('|') && trimmed.length > 0) {
            inTable = false;
          }
        }
      }
    }

    // Also parse "Lịch xe chiều ngược" section
    const reverseMatch = content.match(/## Lịch xe chiều ngược[\s\S]*?(?=\n---|\n## |$)/);
    if (reverseMatch) {
      const lines = reverseMatch[0].split('\n');
      let inTable = false;
      let headerSkipped = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('| Tuyến')) {
          inTable = true;
          headerSkipped = false;
          continue;
        }
        
        if (inTable && !headerSkipped && trimmed.match(/^\|[-:\s|]+\|$/)) {
          headerSkipped = true;
          continue;
        }
        
        if (inTable && headerSkipped && trimmed.startsWith('|')) {
          const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
          if (cells.length >= 2) {
            const routeStr = cells[0];
            const times = cells[1];
            const note = cells[2] || '';
            
            const routeParts = routeStr.split(/→|↔/).map(s => s.trim());
            const from = routeParts[0] || '';
            const to = routeParts[1] || '';
            
            const timeList = times.split(',').map(t => t.trim()).filter(t => t.match(/\d/));
            
            for (const time of timeList) {
              let resolvedVehicle = 'Giường 40 chỗ';
              let cleanedTime = time.trim();
              
              if (cleanedTime.toLowerCase().includes('vip')) {
                resolvedVehicle = 'VIP 9 chỗ';
              }
              
              cleanedTime = cleanedTime.replace(/[()~]|vip|VIP/g, '').trim();
              
              entries.push({
                from,
                to,
                time: cleanedTime,
                vehicle: resolvedVehicle,
                note,
              });
            }
          }
        }
        
        if (inTable && headerSkipped && !trimmed.startsWith('|') && trimmed.length > 0) {
          inTable = false;
        }
      }
    }
    
    return entries;
  }

  /**
   * Đọc và ghép tất cả file .md trong một thư mục
   */
  private readMarkdownDir(dir: string): string {
    if (!fs.existsSync(dir)) return '';
    const combined: string[] = [];
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.md')) {
        combined.push(fs.readFileSync(path.join(dir, file), 'utf-8'));
      }
    }
    return combined.join('\n\n');
  }

  /**
   * Đọc tất cả MD price tables trong một thư mục
   */
  private readMarkdownPriceTables(dir: string): PriceEntry[] {
    if (!fs.existsSync(dir)) return [];
    const allEntries: PriceEntry[] = [];
    
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const entries = this.parseMarkdownPriceTable(content, file);
        allEntries.push(...entries);
      }
    }
    
    return allEntries;
  }

  /**
   * Khởi tạo: Đọc toàn bộ dữ liệu từ Markdown Knowledge Store
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[KnowledgeService] Initializing from Markdown Knowledge Store...');

    // 1. FAQ từ Markdown
    try {
      const faqContent = this.readMarkdownDir(path.join(this.mdStorePath, 'faq'));
      if (faqContent) {
        this.qaPairs = this.parseFAQMarkdown(faqContent);
        console.log(`[KnowledgeService] ✅ Loaded ${this.qaPairs.length} Q&A pairs from Markdown`);
      } else {
        console.warn('[KnowledgeService] ⚠️ FAQ Markdown trống hoặc không tồn tại.');
      }
    } catch (err) {
      console.warn('[KnowledgeService] ⚠️ Could not read FAQ Markdown.', err);
    }

    // 2. Routes từ Markdown
    try {
      const routeContent = this.readMarkdownDir(path.join(this.mdStorePath, 'route'));
      if (routeContent) {
        this.routes = this.parseRouteMarkdown(routeContent);
        console.log(`[KnowledgeService] ✅ Loaded ${this.routes.length} routes from Markdown`);
      }
    } catch (err) {
      console.warn('[KnowledgeService] ⚠️ Could not read Route Markdown.');
    }

    // 3. Prices từ Markdown ticket_fares__tables/
    try {
      const tablesDir = path.join(this.mdStorePath, 'route', 'ticket_fares__tables');
      this.prices = this.readMarkdownPriceTables(tablesDir);
      if (this.prices.length > 0) {
        console.log(`[KnowledgeService] ✅ Loaded ${this.prices.length} price entries from Markdown tables`);
      } else {
        console.warn('[KnowledgeService] ⚠️ Price Markdown tables trống hoặc không tồn tại.');
      }
    } catch (err) {
      console.warn('[KnowledgeService] ⚠️ Could not read price Markdown tables.', err);
    }

    // 4. Schedules từ Markdown schedules.md
    try {
      const scheduleMdPath = path.join(this.mdStorePath, 'route', 'schedules.md');
      if (fs.existsSync(scheduleMdPath)) {
        const scheduleContent = fs.readFileSync(scheduleMdPath, 'utf-8');
        this.schedulesMarkdown = scheduleContent;
        this.schedules = this.parseMarkdownSchedule(scheduleContent);
        console.log(`[KnowledgeService] ✅ Loaded ${this.schedules.length} schedule entries from Markdown`);
        // Debug: show VIP entries
        const vipEntries = this.schedules.filter(s => s.vehicle.toLowerCase().includes('vip'));
        console.log(`[KnowledgeService] 🚐 VIP entries: ${vipEntries.length}`, vipEntries.map(e => `${e.from}→${e.to} ${e.time} (${e.vehicle})`));
      } else {
        console.warn('[KnowledgeService] ⚠️ schedules.md không tồn tại.');
      }
    } catch (err) {
      console.warn('[KnowledgeService] ⚠️ Could not read Schedule Markdown.', err);
    }

    this.initialized = true;
    console.log('[KnowledgeService] 🚀 Knowledge Store ready (Markdown-first).');
  }

  // Tìm giá vé
  findPrice(from: string, to: string): PriceEntry[] {
    const results = this.prices.filter(
      p => this.locationsMatch(p.from, from) && this.locationsMatch(p.to, to)
    );
    if (results.length === 0) {
      return this.prices.filter(
        p => this.locationsMatch(p.from, to) && this.locationsMatch(p.to, from)
      );
    }
    return results;
  }

  // Tìm lịch chạy ĐÚNG chiều (không tự trả chiều ngược)
  findSchedules(from: string, to: string): ScheduleEntry[] {
    return this.schedules.filter(
      s => this.locationsMatch(s.from, from) && this.locationsMatch(s.to, to)
    );
  }

  // Tìm lịch chạy chiều NGƯỢC (dùng để suy ra travel time)
  findReverseSchedules(from: string, to: string): ScheduleEntry[] {
    return this.schedules.filter(
      s => this.locationsMatch(s.from, to) && this.locationsMatch(s.to, from)
    );
  }

  /**
   * Lấy toàn bộ nội dung schedules.md (cho AI context)
   */
  getSchedulesMarkdown(): string {
    return this.schedulesMarkdown;
  }

  /**
   * Tìm kiếm Q&A theo từ khóa
   */
  searchQA(query: string, limit = 5): QAEntry[] {
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

    return this.qaPairs
      .filter(qa => {
        const qLower = qa.question.toLowerCase();
        const aLower = qa.answer.toLowerCase();
        return queryWords.some(word => qLower.includes(word) || aLower.includes(word));
      })
      .slice(0, limit);
  }

  /**
   * Tìm kiếm lộ trình theo từ khóa
   */
  searchRoutes(query: string): RouteEntry[] {
    const q = query.toLowerCase();
    return this.routes.filter(
      r => r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    );
  }

  /** Lấy tất cả lộ trình */
  getAllRoutes(): RouteEntry[] {
    return this.routes;
  }

  getUniqueLocations(): string[] {
    const locations = new Set<string>();
    this.prices.forEach(p => {
      locations.add(p.from);
      locations.add(p.to);
    });
    return Array.from(locations).sort();
  }

  getVehicleTypes(): string[] {
    const types = new Set<string>();
    this.prices.forEach(p => { if (p.vehicle) types.add(p.vehicle); });
    return Array.from(types);
  }

  getStats() {
    return {
      totalPrices: this.prices.length,
      totalQAPairs: this.qaPairs.length,
      totalSchedules: this.schedules.length,
      totalRoutes: this.routes.length,
      uniqueLocations: this.getUniqueLocations().length,
      vehicleTypes: this.getVehicleTypes(),
      knowledgeSource: 'markdown',
    };
  }
}

// Singleton instance
export const knowledgeService = new KnowledgeService();
