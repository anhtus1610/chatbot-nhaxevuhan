/**
 * Tool Definitions cho Function Calling
 * Định nghĩa các tools mà chatbot có thể gọi
 * Tích hợp với Knowledge Service (7,796 giá + 493 Q&A)
 */

import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { checkRouteAndPrice } from './checkRouteAndPrice';
import { getDepartureTimes } from './getDepartureTimes';
import { getETA } from './getETA';
import { getOfficeInfo } from './getOfficeInfo';
import { collectBookingInfo } from './collectBookingInfo';
import { handoffToCSKH } from './handoffToCSKH';
import { checkShippingInfo } from './checkShippingInfo';
import { answerFAQ, checkSpecialSituation } from './answerFAQ';

// Định nghĩa các tools cho OpenAI Function Calling
export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_route_and_price',
      description: 'Kiểm tra điểm đón/trả hợp lệ và lấy giá vé cho tuyến xe. Sử dụng khi khách hỏi về giá vé, điểm đón, điểm trả. Database có 7,796 mức giá.',
      parameters: {
        type: 'object',
        properties: {
          pickup: {
            type: 'string',
            description: 'Điểm đón khách muốn lên xe (VD: Hà Nội, Mỹ Đình, Bắc Giang)'
          },
          dropoff: {
            type: 'string',
            description: 'Điểm trả khách muốn xuống (VD: Xín Mần, Đồng Văn, Mèo Vạc)'
          },
          vehicle: {
            type: 'string',
            enum: ['bus', 'limousine'],
            description: 'Loại xe: bus (xe giường/ghế), limousine (xe VIP)'
          }
        },
        required: ['pickup', 'dropoff']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_departure_times',
      description: 'Lấy lịch các chuyến xe chạy từ điểm A đến điểm B. Sử dụng khi khách hỏi về giờ xe chạy, lịch chạy.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Điểm xuất phát (VD: Hà Nội, Mỹ Đình)'
          },
          to: {
            type: 'string',
            description: 'Điểm đến (VD: Xín Mần, Tuyên Quang)'
          },
          vehicle: {
            type: 'string',
            enum: ['bus', 'limousine', 'all'],
            description: 'Loại xe cần tra cứu'
          },
          date: {
            type: 'string',
            description: 'Ngày đi (format: YYYY-MM-DD), để trống nếu hỏi lịch chung'
          }
        },
        required: ['from', 'to']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'answer_faq',
      description: 'Trả lời câu hỏi thường gặp từ database 493 cặp Q&A. Sử dụng khi khách hỏi về: giá trẻ em, xe cabin, giường đôi, limousine, giảm giá, thẻ đi lại, chuyển khoản, bệnh viện, quy định, chính sách.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Câu hỏi của khách hàng'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_eta',
      description: 'Tính thời gian dự kiến xe đến một điểm trung gian hoặc điểm cuối. Sử dụng khi khách hỏi "xe qua X mấy giờ", "bao lâu đến Y".',
      parameters: {
        type: 'object',
        properties: {
          departure_time: {
            type: 'string',
            description: 'Giờ xuất phát từ bến (VD: 05:30, 19:20)'
          },
          checkpoint: {
            type: 'string',
            description: 'Điểm cần biết giờ qua (VD: Ngã 3 Kim Anh, KM25 cao tốc)'
          },
          from: {
            type: 'string',
            description: 'Điểm xuất phát (mặc định: Mỹ Đình)'
          },
          to: {
            type: 'string',
            description: 'Điểm đến cuối (nếu cần tính tổng thời gian)'
          }
        },
        required: ['departure_time', 'checkpoint']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_office_info',
      description: 'Lấy thông tin văn phòng, địa chỉ, số điện thoại của nhà xe. Sử dụng khi khách hỏi về địa chỉ, số điện thoại, văn phòng.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Tên địa điểm cần tìm văn phòng (VD: Mỹ Đình, Giáp Bát, Tuyên Quang, Xín Mần)'
          }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'collect_booking_info',
      description: 'Thu thập và xác nhận thông tin đặt vé của khách. Sử dụng khi khách muốn đặt vé, giữ chỗ.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Họ tên khách hàng'
          },
          phone_number: {
            type: 'string',
            description: 'Số điện thoại liên hệ'
          },
          pickup: {
            type: 'string',
            description: 'Điểm đón'
          },
          dropoff: {
            type: 'string',
            description: 'Điểm trả'
          },
          departure_date: {
            type: 'string',
            description: 'Ngày đi (định dạng: YYYY-MM-DD). Nếu khách nói "mai", "kia", "thứ mấy" thì phải tự tính toán ra ngày chính xác dựa trên thời điểm hiện tại được cung cấp trong system prompt.'
          },
          departure_time: {
            type: 'string',
            description: 'Giờ chuyến muốn đi (VD: 05:30, 19:20)'
          },
          vehicle_type: {
            type: 'string',
            enum: ['giuong', 'ghe', 'vip'],
            description: 'Loại xe: giuong (giường nằm), ghe (ghế ngồi), vip (limousine)'
          },
          ticket_count: {
            type: 'number',
            description: 'Số lượng vé'
          }
        },
        required: ['pickup', 'dropoff']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_shipping_info',
      description: 'Cung cấp thông tin gửi hàng. Sử dụng khi khách hỏi về gửi hàng, gửi đồ.',
      parameters: {
        type: 'object',
        properties: {
          from_location: {
            type: 'string',
            description: 'Nơi gửi hàng'
          },
          to_location: {
            type: 'string',
            description: 'Nơi nhận hàng'
          }
        },
        required: ['from_location', 'to_location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'handoff_to_cskh',
      description: 'Chuyển hội thoại sang nhân viên CSKH. Sử dụng khi: câu hỏi ngoài tri thức, khách yêu cầu gặp nhân viên, khiếu nại, yêu cầu đặc biệt.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Lý do chuyển CSKH'
          },
          customer_info: {
            type: 'object',
            description: 'Thông tin khách đã thu thập (nếu có)',
            properties: {
              name: { type: 'string' },
              phone: { type: 'string' },
              request: { type: 'string' }
            }
          }
        },
        required: ['reason']
      }
    }
  }
];

// Hàm thực thi tool
export async function executeTool(
  toolName: string,
  args: any,
  operatorId: string
): Promise<any> {
  switch (toolName) {
    case 'check_route_and_price':
      return await checkRouteAndPrice(operatorId, args.pickup, args.dropoff, args.vehicle);
    case 'get_departure_times':
      return await getDepartureTimes(operatorId, args.from, args.to, args.vehicle, args.date);
    case 'answer_faq':
      // Kiểm tra tình huống đặc biệt trước
      const specialAnswer = checkSpecialSituation(args.query);
      if (specialAnswer) {
        return { found: true, answer: specialAnswer, confidence: 1.0 };
      }
      return await answerFAQ(args.query);
    case 'get_eta':
      return await getETA(operatorId, args.departure_time, args.checkpoint, args.from, args.to);
    case 'get_office_info':
      return await getOfficeInfo(operatorId, args.location);
    case 'collect_booking_info':
      return await collectBookingInfo(args, operatorId);
    case 'check_shipping_info':
      return await checkShippingInfo(operatorId, args.from_location, args.to_location);
    case 'handoff_to_cskh':
      return await handoffToCSKH(args.reason, args.customer_info);
    default:
      return { error: 'Unknown tool: ' + toolName };
  }
}
