/**
 * Script chuyển đổi Knowledge Base từ JSON sang Markdown
 * 
 * Chuyển prices.json → ticket_fares__tables/*.md
 * Chuyển gio-theo-xe.csv → route/schedules.md
 * Tạo bus_office_mapping.md
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_ROOT = path.join(__dirname, '../knowledge/operators/vu_han');
const PRICES_JSON = path.join(__dirname, '../knowledge/prices.json');

// ========== ROUTE NAME MAPPING ==========
const routeNameMap = {
  'HN-ĐV': 'Hà Nội ↔ Đồng Văn',
  'HN-MV': 'Hà Nội ↔ Mậu Duệ – Mèo Vạc',
  'BG-MV': 'Bắc Giang ↔ Mèo Vạc',
  'HN-BH-XM': 'Hà Nội ↔ Bắc Hà – Xín Mần',
  'HN-HSP-XM': 'Hà Nội ↔ Hoàng Su Phì – Xín Mần',
  'HN-TQ': 'Hà Nội ↔ Tuyên Quang',
  'HN-MB': 'Hà Nội ↔ Mỹ Bằng',
  'HN-KT': 'Hà Nội ↔ Kiến Thiết',
  'TQ-HN': 'Tuyên Quang → Hà Nội',
  'XM-HSP-HN': 'Xín Mần – Hoàng Su Phì → Hà Nội',
  'MV-BG': 'Mèo Vạc → Bắc Giang',
  'XM-BH-HN': 'Xín Mần – Bắc Hà → Hà Nội',
  'ĐV-HN': 'Đồng Văn → Hà Nội',
  'MB-HN': 'Mỹ Bằng → Hà Nội',
  'KT-HN': 'Kiến Thiết → Hà Nội',
  'MV-HN': 'Mèo Vạc → Hà Nội',
};

// Slugify route code cho tên file
function slugifyRoute(routeCode) {
  return routeCode
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ========== CONVERT PRICES.JSON → MD ==========
function convertPrices() {
  console.log('\n=== Converting prices.json → Markdown tables ===');
  
  const prices = JSON.parse(fs.readFileSync(PRICES_JSON, 'utf-8'));
  console.log('Total price entries:', prices.length);
  
  // Group by route
  const byRoute = {};
  for (const p of prices) {
    if (!byRoute[p.route]) byRoute[p.route] = [];
    byRoute[p.route].push(p);
  }
  
  // Create ticket_fares__tables directory
  const tablesDir = path.join(KNOWLEDGE_ROOT, 'route', 'ticket_fares__tables');
  if (!fs.existsSync(tablesDir)) {
    fs.mkdirSync(tablesDir, { recursive: true });
  }
  
  let totalWritten = 0;
  
  for (const [routeCode, entries] of Object.entries(byRoute)) {
    const routeName = routeNameMap[routeCode] || routeCode;
    const slug = slugifyRoute(routeCode);
    const filePath = path.join(tablesDir, slug + '.md');
    
    // Group by vehicle type
    const byVehicle = {};
    for (const e of entries) {
      const v = e.vehicle || 'Không xác định';
      if (!byVehicle[v]) byVehicle[v] = [];
      byVehicle[v].push(e);
    }
    
    let md = '# Bảng giá vé: ' + routeName + ' (' + routeCode + ')\n\n';
    md += '> Cập nhật: 2026-03-08\n\n';
    
    for (const [vehicle, vEntries] of Object.entries(byVehicle)) {
      md += '## ' + vehicle + '\n\n';
      md += '| Điểm đi | Điểm đến | Giá (k) |\n';
      md += '|---------|----------|--------:|\n';
      
      for (const e of vEntries) {
        md += '| ' + e.from + ' | ' + e.to + ' | ' + e.price + ' |\n';
      }
      
      md += '\n';
    }
    
    fs.writeFileSync(filePath, md, 'utf-8');
    totalWritten += entries.length;
    console.log('  ✅ ' + slug + '.md — ' + entries.length + ' entries (' + Object.keys(byVehicle).length + ' vehicle types)');
  }
  
  console.log('\n✅ Total price entries written to MD: ' + totalWritten);
  return totalWritten;
}

// ========== CONVERT SCHEDULES → MD ==========
function convertSchedules() {
  console.log('\n=== Creating schedules.md from gio-theo-xe.csv data ===');
  
  const filePath = path.join(KNOWLEDGE_ROOT, 'route', 'schedules.md');
  
  // Parse the detailed schedule data from gio-theo-xe.csv
  // This data is complex (multi-column CSV), so we build a comprehensive MD from it
  
  const md = `# Lịch chạy xe Nhà xe Vũ Hán

> Cập nhật: 2026-03-08

---

## Tuyến Hà Nội – Đồng Văn (HN-ĐV)

- **Xe**: Giường nằm 40 chỗ (29F-028.44 / 29F-028.74)
- **SĐT xe**: 0346152828 / 0329532828 (2 xe đối lưu ngày chẵn lẻ)

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Đồng Văn | 19:30 | Đến ĐV sáng hôm sau |
| Đồng Văn → Mỹ Đình | 17:30 | Đến HN sáng hôm sau |

### ETA dự kiến (chiều đi Mỹ Đình → Đồng Văn)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Bầu | 19:50 |
| Nam Hồng | 20:00 |
| Mê Linh / Quang Minh | 20:05 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 20:10 |
| KM14 / Bình Xuyên | 20:25 |
| KM25 / nút giao Tam Đảo | 20:40 |
| KM41 / Văn Quán | 20:50 |
| KM49 / IC7 | 21:00 |
| IC8 / VP Phú Thọ | 21:10 |
| IC9 / Thị xã Phú Thọ | 21:30 |
| Đoan Hùng | 22:40 |
| Tuyên Quang (TP cũ) | 23:00 |
| Hàm Yên | 23:30 |
| Bắc Quang | 00:50 |
| Tân Quang | 01:05 |
| Vị Xuyên | 01:35 |
| Hà Giang (TP cũ) | 01:50 |
| Quản Bạ – Tam Sơn | 03:15 |
| Yên Minh | 04:00 |
| Phố Bảng / Sủng Là | ~06:00 |
| Sà Phìn | ~05:50 |
| Đồng Văn | ~06:10 |

### ETA dự kiến (chiều về Đồng Văn → Mỹ Đình)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Sà Phìn | 17:50 |
| Phố Bảng / Sủng Là | 18:00 |
| Phố Cáo | 18:40 |
| Hữu Vinh | 19:10 |
| Yên Minh | 19:20 |
| Quản Bạ – Tam Sơn | 21:30 |
| Hà Giang (TP cũ) | 22:45 |
| Vị Xuyên | 23:00 |
| Tân Quang | 23:30 |
| Bắc Quang / Việt Quang | 23:45 |
| Hàm Yên | 01:00 |
| Tuyên Quang (TP cũ) | 02:15 |
| Đoan Hùng | 02:30 |
| IC9 / Thị xã Phú Thọ | 03:00 |
| IC8 / VP Phú Thọ | 03:10 |
| KM49 / IC7 | 03:20 |
| KM41 / Văn Quán | 03:30 |
| KM25 / nút giao Tam Đảo | ~03:40 |
| Ngã 3 Kim Anh | ~05:00 |
| Hà Nội (Mỹ Đình) | ~05:30 |

---

## Tuyến Hà Nội – Mậu Duệ – Mèo Vạc (HN-MV)

- **Xe**: Giường nằm 40 chỗ (29F-028.21)
- **SĐT xe**: 0347002828

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Mèo Vạc | 18:30 | Đến MV sáng hôm sau |
| Mèo Vạc → Mỹ Đình | 05:30 | Đến HN tối cùng ngày |

### ETA dự kiến (chiều đi Mỹ Đình → Mèo Vạc)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Bầu | 18:40 |
| Nam Hồng | 18:50 |
| Mê Linh / Quang Minh | 18:55 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 19:00 |
| KM14 / Bình Xuyên | 19:15 |
| KM25 / nút giao Tam Đảo | 19:30 |
| KM41 / Văn Quán | 19:40 |
| KM49 / IC7 | 19:50 |
| IC8 / VP Phú Thọ | 20:00 |
| IC9 / Thị xã Phú Thọ | 20:20 |
| Đoan Hùng | 21:00 |
| Tuyên Quang (TP cũ) | 21:30 |
| Hàm Yên | 22:10 |
| Bắc Quang / Việt Quang | 23:10 |
| Tân Quang | 23:25 |
| Vị Xuyên | 00:00 |
| Hà Giang (TP cũ) | 00:30 |
| Quản Bạ – Tam Sơn | 02:00 |
| Yên Minh | 03:00 |
| Mậu Duệ | ~04:00 |
| Mèo Vạc | ~05:00 |

### ETA dự kiến (chiều về Mèo Vạc → Mỹ Đình)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Tát Ngà | 05:45 |
| Niêm Sơn | 06:00 |
| Niêm Tòng | 06:10 |
| Khuổi Vin | 06:20 |
| Pác Rà / Nà Phòng | 06:30 |
| Lý Bôn | 06:40 |
| Nà Ca | 06:50 |
| Pắc Rôm | 06:55 |
| Pác Miầu / Bảo Lâm | 07:00 |
| Nà Bản | 07:20 |
| Nà Vuông | 07:40 |
| Bản Tính | 07:50 |
| Bắc Mê | 08:00 |
| Yên Cường | 08:30 |
| Đường Âm | 08:50 |
| Đường Hồng | 09:00 |
| Thượng Giáp | 09:10 |
| Thượng Nông | 09:30 |
| Yên Hoa | 09:45 |
| Đà Vị | 10:00 |
| Sơn Phú | 11:00 |
| Na Hang | 12:00 |
| Chiêm Hoá (Vĩnh Lộc) | 12:40 |
| Bợ | 13:10 |
| Tuyên Quang (TP cũ) | ~14:00 |
| Hà Nội (Mỹ Đình) | ~17:00 |

---

## Tuyến Bắc Giang – Mèo Vạc (BG-MV)

- **Xe**: Giường nằm 40 chỗ (29B-174.04 / 29F-027.95)
- **SĐT xe**: 0329762828 / 0866508228 (2 xe đối lưu ngày chẵn lẻ)

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Bắc Giang → Mèo Vạc | 16:30 | Qua Mỹ Đình ~19:20, đến MV sáng hôm sau |
| Mèo Vạc → Bắc Giang | 15:30 | Đến BG sáng hôm sau |

### ETA dự kiến (chiều đi BG → Mèo Vạc)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Cầu Tử Thần | 16:45 |
| Quảng Châu | 17:10 |
| Đình Trám | 17:20 |
| Đa Cấu / Bắc Ninh | 17:50 |
| Làng Giang | 18:10 |
| Yên Phong | 19:00 |
| Cầu Chờ | 19:20 |
| Hà Nội (Mỹ Đình) | 19:20 |
| Bầu | 19:40 |
| Nam Hồng | 19:50 |
| Mê Linh / Quang Minh | 19:55 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 20:00 |
| KM14 / Bình Xuyên | 20:15 |
| KM25 / nút giao Tam Đảo | 20:30 |
| KM41 / Văn Quán | 20:40 |
| KM49 / IC7 | 20:50 |
| IC8 / VP Phú Thọ | 21:00 |
| IC9 / Thị xã Phú Thọ | 21:20 |
| Đoan Hùng | 22:30 |
| Tuyên Quang (TP cũ) | 22:50 |
| KM31 Hàm Yên | 23:20 |
| Bợ | 23:30 |
| Chiêm Hoá (Vĩnh Lộc) | ~00:00 |
| Na Hang | ~01:00 |
| Bắc Mê | ~04:00 |
| Bảo Lâm | ~05:00 |
| Mèo Vạc | ~06:00 |

---

## Tuyến Hà Nội – Bắc Hà – Xín Mần (HN-BH-XM) — Xe 10h

- **Xe**: Giường nằm 40 chỗ (29B-168.15)
- **SĐT xe**: 0915656255

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Xín Mần | 10:00 | Đến Xín Mần tối cùng ngày |
| Xín Mần → Mỹ Đình | 19:30 | Đến HN sáng hôm sau |

### ETA dự kiến (chiều đi 10h: Mỹ Đình → Xín Mần)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Bầu | 10:20 |
| Nam Hồng | 10:25 |
| Mê Linh / Quang Minh | 10:30 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 10:35 |
| KM14 / Bình Xuyên | 10:50 |
| KM25 / nút giao Tam Đảo | 11:05 |
| KM41 / Văn Quán | 11:20 |
| IC8 / VP Phú Thọ | 11:35 |
| IC9 / Thị xã Phú Thọ | 12:15 |
| Bảo Hà – Đền Ông Bảy | ~14:00 |
| Phố Lu | ~14:30 |
| Bắc Ngầm | ~15:00 |
| Bảo Nhai | ~15:30 |
| Bắc Hà | ~16:00 |
| Lùng Phình | ~16:30 |
| Nàn Ma | ~17:15 |
| Cốc Pài / Xín Mần | ~18:00 |

---

## Tuyến Hà Nội – Bắc Hà – Xín Mần (HN-BH-XM) — Xe 19h20

- **Xe**: Giường nằm 40 chỗ (29B-167.11)
- **SĐT xe**: 0982119189

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Xín Mần | 19:20 | Đến Xín Mần sáng hôm sau |
| Xín Mần → Mỹ Đình | 08:20 | Đến HN tối cùng ngày |

### ETA dự kiến (chiều đi 19h20: Mỹ Đình → Xín Mần)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Bầu | 19:40 |
| Nam Hồng | 19:45 |
| Mê Linh / Quang Minh | 19:55 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 20:00 |
| KM14 / Bình Xuyên | 20:15 |
| KM25 / nút giao Tam Đảo | 20:30 |
| KM41 / Văn Quán | 20:45 |
| IC8 / VP Phú Thọ | 21:00 |
| IC9 / Thị xã Phú Thọ | 21:40 |
| Bảo Hà – Đền Ông Bảy | ~23:10 |
| Phố Lu | ~23:40 |
| Bắc Ngầm | ~00:00 |
| Bảo Nhai | ~00:25 |
| Bắc Hà | ~01:00 |
| Lùng Phình | ~01:30 |
| Nàn Ma | ~02:10 |
| Cốc Pài / Xín Mần | ~04:00 |

---

## Tuyến Hà Nội – Hoàng Su Phì – Xín Mần (HN-HSP-XM)

- **Xe**: VIP 9 chỗ (29E-13080)
- **SĐT xe**: 0377238228

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Xín Mần | 05:30 | Đến Xín Mần chiều cùng ngày |
| Xín Mần → Mỹ Đình | 13:00 | Đến HN tối cùng ngày |

### ETA dự kiến (chiều đi 5h30: Mỹ Đình → Xín Mần)

| Điểm | Giờ qua (ước tính) |
|------|:------------------:|
| Bầu | 05:50 |
| Nam Hồng | 05:55 |
| Mê Linh / Quang Minh | 06:00 |
| Ngã 3 Kim Anh / Ngã 4 Nội Bài | 06:05 |
| KM14 / Bình Xuyên | 06:20 |
| KM25 / nút giao Tam Đảo | 06:30 |
| KM41 / Văn Quán | 06:45 |
| IC8 / VP Phú Thọ | 06:55 |
| IC9 / Thị xã Phú Thọ | 07:00 |
| Đoan Hùng | 07:20 |
| Tuyên Quang (TP cũ) | 07:40 |
| Hàm Yên | 08:45 |
| Bắc Quang / Việt Quang | 09:45 |
| Tân Quang | 10:30 |
| Nậm Ty – Nậm Dịch | 11:30 |
| Hoàng Su Phì (Vinh Quang) | 12:10 |
| Cốc Pài / Xín Mần | 13:30 |

---

## Tuyến Hà Nội – Tuyên Quang (HN-TQ) — Xe ghế

Có nhiều chuyến trong ngày:

| Xe | Biển số | SĐT | Giờ đi (HN) | Giờ về (TQ) | Loại xe |
|-----|---------|------|:-----------:|:-----------:|---------|
| Xe ghế 1 | 29B-408.26 | 0941272838 | 06:20 | 14:20 | Ghế 29 chỗ |
| Xe ghế 2 | 29B-402.23 | 0913527136 | 15:25 | 08:30 | Ghế 29 chỗ |
| Xe ghế 3 | 29E-10347 | 0346122828 | 17:50 | 12:45 | Ghế 29 chỗ |
| Xe ghế 4 | 29B-405.63 | 0913038089 | 06:55 | 13:15 | Ghế 29 chỗ |
| Xe ghế 5 | 29B-168.06 | 0915681999 | 07:50 | 13:10 | Ghế 45 chỗ |

### Giờ đi từ Hà Nội → Tuyên Quang (tổng hợp tất cả loại xe)

| Giờ KH | Loại xe | Ghi chú |
|:------:|---------|---------|
| 05:30 | VIP 9 chỗ | Sớm nhất, đến TQ ~07:30 |
| 06:20 | Ghế 29 chỗ | Đến TQ ~09:30 |
| 06:55 | Ghế 29 chỗ | Đến TQ ~10:00 |
| 07:50 | Ghế 45 chỗ | Đến TQ ~11:00 |
| 15:25 | Ghế 29 chỗ | Đến TQ ~18:00 |
| 17:50 | Ghế 29 chỗ | Đến TQ ~20:00 |
| 18:30 | Giường 40 chỗ | Đến TQ ~21:00 |
| 19:30 | Giường 40 chỗ | Muộn nhất, đến TQ ~23:00 |

### Giờ về từ Tuyên Quang → Hà Nội

| Giờ KH | Loại xe | Ghi chú |
|:------:|---------|---------|
| 08:30 | Ghế 29 chỗ | |
| 12:45 | Ghế 29 chỗ | |
| 13:10 | Ghế 45 chỗ | |
| 13:15 | Ghế 29 chỗ | |
| 14:00 | Ghế 29 chỗ | |
| 14:20 | Ghế 29 chỗ | |
| 19:30 | VIP 9 chỗ | |
| 23:45 | Giường 40 chỗ (HN-MV/ĐV) | Xe đi qua |
| 02:30 | Giường 40 chỗ (HN-ĐV) | Xe đi qua |

---

## Tuyến Hà Nội – Mỹ Bằng (HN-MB)

- **Xe**: Ghế 29 chỗ (29B-405.63)
- **SĐT xe**: 0913038089

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Mỹ Bằng | 06:55 | Đến MB ~10:00 |
| Mỹ Bằng → Mỹ Đình | 13:15 | Đến HN ~16:00 |

---

## Tuyến Hà Nội – Kiến Thiết (HN-KT)

- **Xe**: Ghế 45 chỗ (29B-168.06)
- **SĐT xe**: 0915681999

| Chiều | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mỹ Đình → Kiến Thiết | 07:50 | Đến KT ~11:00 |
| Kiến Thiết → Mỹ Đình | 13:10 | Đến HN ~16:00 |

---

## Tóm tắt tất cả giờ khởi hành từ Hà Nội (Mỹ Đình)

| Tuyến chính | Giờ khởi hành | Loại xe |
|-------------|:------------:|---------|
| Hà Nội → Xín Mần | 05:30, 10:00, 19:20 | VIP (5:30), Giường (10:00, 19:20) |
| Hà Nội → Hoàng Su Phì | 05:30 | VIP 9 chỗ |
| Hà Nội → Đồng Văn | 19:30 | Giường 40 chỗ |
| Hà Nội → Mèo Vạc | 18:30 | Giường 40 chỗ |
| Hà Nội → Yên Minh / Mậu Duệ | 18:30, 19:30 | Giường 40 chỗ |
| Hà Nội → Quản Bạ / Quyết Tiến | 18:30, 19:30 | Giường 40 chỗ |
| Hà Nội → Tuyên Quang (TP) | 05:30, 06:20, 06:55, 07:50, 15:25, 17:50, 18:30, 19:30 | VIP, Ghế, Giường |
| Hà Nội → Na Hang, Chiêm Hoá, Đà Vị | 19:20 | Giường 40 chỗ (xe BG-MV qua HN ~19:20) |
| Hà Nội → Bảo Lâm, Lý Bôn, Niêm Sơn | 19:20 | Giường 40 chỗ (xe BG-MV qua HN ~19:20) |
| Hà Nội → Suối khoáng Mỹ Lâm, Mỹ Bằng | 06:55 | Ghế 29 chỗ |
| Hà Nội → Xuân Vân, Kiến Thiết, Trung Trực | 07:50 | Ghế 45 chỗ |
| Hà Nội → Bắc Hà, Bảo Nhai, Lu | 10:00, 19:20 | Giường 40 chỗ |

---

## Lịch xe chiều ngược (mẫu thường hỏi)

| Tuyến | Giờ khởi hành | Ghi chú |
|-------|:------------:|---------|
| Mèo Vạc → Hà Nội | 05:30, 15:30 | |
| Đồng Văn → Hà Nội | 17:30 | |
| Xín Mần → Hà Nội | 08:20, 19:30 | |
| Hoàng Su Phì → Hà Nội | 14:00 (VIP) | |
| Tuyên Quang → Hà Nội | 08:30, 12:45, 13:10, 13:15, 14:00, 14:20, 19:30(VIP), 23:45, 02:30 | |
| Na Hang → Hà Nội | 11:40, 21:30 | |
| Chiêm Hoá → Hà Nội | 12:40, 22:20 | |
| Bắc Hà → Xín Mần | ~16:00, ~01:00 | |
| Bảo Nhai → Xín Mần | ~15:30, ~00:30 | |
| Lu → Xín Mần | ~15:00, ~00:00 | |
| Bắc Giang → Mèo Vạc | 16:10 | |
| Mèo Vạc → Bắc Giang | 15:30 | |

---

## Lưu ý quan trọng

- ETA là **ước tính**, có thể thay đổi theo điều kiện giao thông thực tế
- Lái phụ xe sẽ liên hệ xác nhận giờ chính xác trước 1-2 tiếng
- Xe đi **cao tốc Nội Bài – Lào Cai** nên Vĩnh Phúc phải ra nút giao (KM14, KM25, KM41)
- Xe **BG-MV** chạy từ Bắc Giang 16h30, qua Mỹ Đình ~19h20, nên tuyến Na Hang/Bảo Lâm từ HN cũng là 19h20
`;
  
  fs.writeFileSync(filePath, md, 'utf-8');
  console.log('  ✅ schedules.md created');
}

// ========== CREATE BUS OFFICE MAPPING ==========
function createBusOfficeMapping() {
  console.log('\n=== Creating bus_office_mapping.md ===');
  
  const filePath = path.join(KNOWLEDGE_ROOT, 'route', 'bus_office_mapping.md');
  
  const md = `# Văn phòng đón khách theo tuyến xe

## Mỹ Đình (Hà Nội) — Văn phòng chính

- **Địa chỉ**: N5 A2 Ngõ 1 Nguyễn Hoàng, mặt sau bến xe Mỹ Đình (ô 18 cho tuyến Tuyên Quang)
- **SĐT**: 0912 037 237
- **Giờ làm việc**: Đến 20:00 (nhận hàng đến 18:00)
- **Tuyến**: Tất cả các tuyến từ Hà Nội

## Giáp Bát (Hà Nội)

- **Địa chỉ**: 757 Giải Phóng
- **SĐT**: 0348 335 885
- **Giờ làm việc**: Nhận hàng đến 17:00

## Tuyên Quang

- **Địa chỉ**: 95 đường Chiến Thắng Sông Lô, P. Minh Xuân (cửa bến xe Tuyên Quang)
- **SĐT**: 0372 828 828
- **Giờ làm việc**: Đến 23:00
- **Tuyến**: TQ → HN, TQ → Hà Giang, TQ → Xín Mần

## Xín Mần

- **Địa chỉ**: Tổ 1 xã Pà Vầy Sủ (khách sạn Huyền An)
- **Tuyến**: XM → HN

## Mèo Vạc

- **Địa chỉ**: Tổ 2 thị trấn Mèo Vạc (trên chợ, trên quảng trường)
- **Tuyến**: MV → HN, MV → BG

## Fanpage & Zalo OA

- **Fanpage**: facebook.com/vuhangroup
- **Zalo OA**: Tìm "Xe khách Vũ Hán" (có tích vàng) → Đặt vé qua Zalo
`;
  
  fs.writeFileSync(filePath, md, 'utf-8');
  console.log('  ✅ bus_office_mapping.md created');
}

// ========== MAIN ==========
function main() {
  console.log('🚀 Knowledge Base Migration: JSON → Markdown');
  console.log('=============================================');
  
  const totalPrices = convertPrices();
  convertSchedules();
  createBusOfficeMapping();
  
  console.log('\n=============================================');
  console.log('🎉 Migration complete!');
  console.log('   - ' + totalPrices + ' price entries → MD tables');
  console.log('   - Schedules → schedules.md');
  console.log('   - Bus office mapping → bus_office_mapping.md');
  console.log('\nNext: Update KnowledgeService.ts to read from MD');
}

main();
