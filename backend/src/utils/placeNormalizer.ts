/**
 * Utility chuẩn hóa và map địa điểm
 */

export interface NormalizeResult {
  original: string;
  normalized: string;
  canonical: string;
  score: number;
  matched_alias?: string;
}

// Bảng alias địa điểm
const aliases: { [key: string]: string } = {
  // Xín Mần
  'coc_pai': 'xin_man',
  'pa_vay_su': 'xin_man',
  'xin_man': 'xin_man',
  
  // Bảo Lâm
  'pac_mau': 'bao_lam',
  'bao_lam': 'bao_lam',
  
  // Hoàng Su Phì
  'vinh_quang': 'hoang_su_phi',
  'su_phi': 'hoang_su_phi',
  'hoang_su_phi': 'hoang_su_phi',
  
  // Quản Bạ
  'tam_son': 'quan_ba',
  'quyet_tien': 'quan_ba',
  'quan_ba': 'quan_ba',
  
  // Chiêm Hóa
  'vinh_loc': 'chiem_hoa',
  'chiem_hoa': 'chiem_hoa',
  
  // Điểm giao thông
  'km14_vinh_phuc': 'km14_binh_xuyen',
  'km14_binh_xuyen': 'km14_binh_xuyen',
  'km14': 'km14_binh_xuyen',
  'nga_3_kim_anh': 'nga_4_noi_bai',
  'nga_4_noi_bai': 'nga_4_noi_bai',
  
  // Cùng vùng
  'cau_thang_long': 'cau_thang_long',
  'ciputra': 'cau_thang_long',
  'cong_vien_hoa_binh': 'cau_thang_long',
  
  // Hà Nội
  'my_dinh': 'ha_noi',
  'ha_noi': 'ha_noi',
  'ben_xe_my_dinh': 'ha_noi',
  
  // Các điểm khác
  'dong_van': 'dong_van',
  'meo_vac': 'meo_vac',
  'yen_minh': 'yen_minh',
  'mau_due': 'yen_minh',
  'tuyen_quang': 'tuyen_quang',
  'tp_tuyen_quang': 'tuyen_quang',
  'bac_giang': 'bac_giang',
  'tp_bac_giang': 'bac_giang',
  'bac_ha': 'bac_ha',
  'lu': 'lu',
  'bao_nhai': 'bao_nhai',
  'bao_ha': 'bao_ha',
  'den_ong_bay': 'bao_ha',
  'na_hang': 'na_hang',
  'ha_giang': 'ha_giang',
  'tp_ha_giang': 'tp_ha_giang',
  'thanh_pho_ha_giang': 'tp_ha_giang',
  'tp': 'tp_ha_giang',
  'thanh_pho': 'tp_ha_giang',
  'tp_lao_cai': 'tp_lao_cai',
  'lao_cai': 'tp_lao_cai',
  'tp_cao_bang': 'tp_cao_bang',
  'cao_bang': 'tp_cao_bang',
  'bao_lac': 'bao_lac',
  'phu_tho': 'phu_tho',
  'viet_tri': 'phu_tho',
  'ham_yen': 'ham_yen',
  'tan_quang': 'tan_quang',
  'vinh_phuc': 'vinh_phuc'
};

// Tên hiển thị chính thức
const canonicalNames: { [key: string]: string } = {
  'xin_man': 'Xín Mần',
  'bao_lam': 'Bảo Lâm',
  'hoang_su_phi': 'Hoàng Su Phì',
  'quan_ba': 'Quản Bạ',
  'chiem_hoa': 'Chiêm Hóa',
  'km14_binh_xuyen': 'KM14 Bình Xuyên',
  'nga_4_noi_bai': 'Ngã 4 Nội Bài',
  'cau_thang_long': 'Cầu Thăng Long',
  'ha_noi': 'Hà Nội',
  'dong_van': 'Đồng Văn',
  'meo_vac': 'Mèo Vạc',
  'yen_minh': 'Yên Minh',
  'tuyen_quang': 'Tuyên Quang',
  'bac_giang': 'Bắc Giang',
  'bac_ha': 'Bắc Hà',
  'lu': 'Lu',
  'bao_nhai': 'Bảo Nhai',
  'bao_ha': 'Bảo Hà',
  'na_hang': 'Na Hang',
  'ha_giang': 'Hà Giang',
  'tp_ha_giang': 'TP Hà Giang',
  'tp_lao_cai': 'TP Lào Cai',
  'tp_cao_bang': 'TP Cao Bằng',
  'bao_lac': 'Bảo Lạc',
  'phu_tho': 'Phú Thọ',
  'ham_yen': 'Hàm Yên',
  'tan_quang': 'Tân Quang',
  'vinh_phuc': 'Vĩnh Phúc',
  'km25': 'KM25 cao tốc',
  'km41': 'KM41 cao tốc'
};

export function normalizePlace(input: string): NormalizeResult {
  // Chuẩn hóa text
  const normalized = normalizeText(input);
  
  // Tìm trong alias
  const aliasKey = aliases[normalized];
  
  if (aliasKey) {
    return {
      original: input,
      normalized: aliasKey,
      canonical: canonicalNames[aliasKey] || input,
      score: 1.0,
      matched_alias: normalized !== aliasKey ? normalized : undefined
    };
  }

  // Fuzzy match nếu không tìm thấy exact
  const fuzzyResult = fuzzyMatch(normalized);
  if (fuzzyResult) {
    return {
      original: input,
      normalized: fuzzyResult.key,
      canonical: canonicalNames[fuzzyResult.key] || input,
      score: fuzzyResult.score,
      matched_alias: normalized
    };
  }

  // Trả về nguyên bản nếu không match
  return {
    original: input,
    normalized: normalized,
    canonical: input,
    score: 0.5
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function fuzzyMatch(input: string): { key: string; score: number } | null {
  const keys = Object.keys(aliases);
  
  for (const key of keys) {
    // Simple substring match
    if (key.includes(input) || input.includes(key)) {
      return { key: aliases[key], score: 0.8 };
    }
  }
  
  return null;
}
