/**
 * Tool trả lời câu hỏi thường gặp (FAQ)
 * Sử dụng 493 cặp Q&A từ file Excel training
 */

import { knowledgeService } from '../services/KnowledgeService';

export interface FAQResult {
  found: boolean;
  question: string;
  answer: string;
  confidence: number;
  related_questions?: string[];
}

export async function answerFAQ(query: string): Promise<FAQResult> {
  if (!query) {
    return {
      found: false,
      question: '',
      answer: 'Dạ e đã tiếp nhận thông tin của anh chị ạ. Anh chị chờ giây lát em sẽ chuyển qua bộ phận chuyên trách xử lý ạ.',
      confidence: 0
    };
  }

  // Đảm bảo Knowledge Service đã khởi tạo
  await knowledgeService.init();

  // Tìm Q&A phù hợp
  const matches = knowledgeService.searchQA(query);

  if (matches.length === 0) {
    return {
      found: false,
      question: query,
      answer: 'Dạ e đã tiếp nhận thông tin của anh chị ạ. Anh chị chờ giây lát em sẽ chuyển qua bộ phận chuyên trách xử lý ạ.',
      confidence: 0
    };
  }

  // Lấy câu trả lời phù hợp nhất
  const bestMatch = matches[0];
  
  return {
    found: true,
    question: bestMatch.question,
    answer: bestMatch.answer,
    confidence: 0.8,
    related_questions: matches.slice(1, 4).map(m => m.question)
  };
}

// Các tình huống đặc biệt
export const specialSituations: { [key: string]: string } = {
  // Giá trẻ em
  'tre_em': 'Giá vé trẻ em: dưới 1m1 miễn phí; 1,1-1,4m có giá bằng 50% giá vé niêm yết, >1,4m theo giá niêm yết',
  
  // Xe cabin
  'cabin': 'Dạ xe cabin chỉ được phép đi đường bằng ạ còn với xe vùng cao, đường đèo chỉ có duy nhất một loại xe giường như bên em đang sử dụng được phép hoạt động, thiết kế cabin không được phép hoạt động ạ.',
  
  // Giường đôi
  'giuong_doi': 'Xe giường bên em có cả giường đơn và giường đôi ạ',
  
  // Limousine vs Giường
  'limousine': 'Dạ xe giường đi vùng cao thì chỉ có một loại xe duy nhất là xe giường thường bên em đang sử dụng ạ',
  
  // Giảm giá
  'giam_gia': 'Dạ giá khách và hàng bên em đã có quy định chung rồi ạ. Nếu anh chị ở trong trường hợp đặc biệt thì vui lòng để lại thông tin, bộ phận chuyên trách bên em sẽ liên hệ lại ạ',
  
  // Thẻ đi lại
  'the_di_lai': 'Dạ anh chị hay đi lại thường xuyên có thể nghiên cứu mua thẻ đi lại bên em để được giảm giá 5% ạ. Anh chị chuyển tiền xong bên em sẽ gửi cho anh chị thẻ. Khi đi anh chị cầm thẻ đưa cho lái phụ xe ký ngày đi vào là được ạ',
  
  // Đặt vé
  'dat_ve': 'Ac tìm trên zalo đánh chữ Xe khách Vũ Hán sẽ hiện lên zalo OA Xe khách Vũ Hán có tích vàng. ac kích vào Đặt vé qua zalo, bên e có hướng dẫn đó ạ',
  
  // Chuyển khoản
  'chuyen_khoan': 'Dạ mình nên chuyển khoản để bên em giữ chỗ cho tiện ạ',
  
  // Trung chuyển bệnh viện
  'benh_vien': 'Dạ bên em có đưa đón một số bệnh viện lớn tại Hà Nội ạ',
  
  // Điểm Vĩnh Tường
  'vinh_tuong': 'Mời a/c ra nút giao KM25 hoặc 41 chỗ nào gần a/c nhất',
  
  // Điểm Vĩnh Phúc  
  'vinh_phuc': 'Mời a/c ra nút giao KM14 hoặc 25 chỗ nào gần a/c nhất'
};

// Kiểm tra tình huống đặc biệt
export function checkSpecialSituation(query: string): string | null {
  if (!query) return null;
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('trẻ em') || lowerQuery.includes('tre em') || lowerQuery.includes('bé')) {
    return specialSituations.tre_em;
  }
  
  if (lowerQuery.includes('cabin')) {
    return specialSituations.cabin;
  }
  
  if (lowerQuery.includes('giường đôi') || lowerQuery.includes('giuong doi')) {
    return specialSituations.giuong_doi;
  }
  
  if (lowerQuery.includes('limousine') || lowerQuery.includes('limo')) {
    return specialSituations.limousine;
  }
  
  if (lowerQuery.includes('giảm giá') || lowerQuery.includes('giam gia') || lowerQuery.includes('bớt')) {
    return specialSituations.giam_gia;
  }
  
  if (lowerQuery.includes('thẻ đi lại') || lowerQuery.includes('the di lai')) {
    return specialSituations.the_di_lai;
  }
  
  if (lowerQuery.includes('chuyển khoản') || lowerQuery.includes('chuyen khoan') || lowerQuery.includes('giữ chỗ')) {
    return specialSituations.chuyen_khoan;
  }
  
  if (lowerQuery.includes('bệnh viện') || lowerQuery.includes('benh vien')) {
    return specialSituations.benh_vien;
  }
  
  if (lowerQuery.includes('vĩnh tường') || lowerQuery.includes('vinh tuong')) {
    return specialSituations.vinh_tuong;
  }
  
  if (lowerQuery.includes('vĩnh phúc') || lowerQuery.includes('vinh phuc')) {
    return specialSituations.vinh_phuc;
  }
  
  return null;
}
