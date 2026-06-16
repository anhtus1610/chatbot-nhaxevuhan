/**
 * VuHan Chatbot Agent
 * Agent chính xử lý hội thoại với khách hàng, sử dụng OpenAI với function calling
 */

import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { tools, executeTool } from '../tools';
import { systemPrompt } from './systemPrompt';

// Lazy initialization - tạo sau khi dotenv.config() đã chạy
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return _openai;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ChatResponse {
  message: string;
  intent?: string;
  bookingData?: BookingData;
  needsEscalation?: boolean;
  toolCalls?: ToolCallResult[];
}

export interface BookingData {
  customerName?: string;
  phoneNumber?: string;
  pickup?: string;
  dropoff?: string;
  departureDate?: string;
  departureTime?: string;
  vehicleType?: string;
  ticketCount?: number;
  price?: number;
}

export interface ToolCallResult {
  toolName: string;
  result: any;
}

export class VuHanChatAgent {
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private operatorId: string;
  private model: string;
  private userProfile: any;

  constructor(operatorId: string = 'vu_han', userProfile?: any) {
    this.operatorId = operatorId;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.userProfile = userProfile;
    this.initializeConversation();
  }

  private initializeConversation(): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let promptAddition = '';
    if (this.userProfile?.bookingHistory && this.userProfile.bookingHistory.length > 0) {
      const history = this.userProfile.bookingHistory;
      const lastBooking = history[history.length - 1];
      const customerName = this.userProfile.name || 'khách';
      const from = lastBooking.pickup || lastBooking.from;
      const to = lastBooking.dropoff || lastBooking.to;
      if (from && to) {
        promptAddition = `\n\n**QUY TẮC ĐẶC BIỆT (ƯU TIÊN HÀNG ĐẦU)**:
Khách hàng này tên là "${customerName}" (SĐT: ${this.userProfile.phone || 'chưa có'}).
Khách hàng có lịch sử vừa đặt chuyến đi từ "${from}" đến "${to}".
Ngay trong câu trả lời đầu tiên của cuộc trò chuyện (bất kể khách hàng nói gì như "alo", "tôi muốn đặt vé", v.v.), bạn BẮT BUỘC phải chủ động chào hỏi theo tên khách và gợi ý ngay chuyến xe khứ hồi ngược lại từ "${to}" về "${from}" cho khách hàng này.
Ví dụ: "Dạ em vừa thấy anh/chị ${customerName} đặt chuyến đi ${from} -> ${to}, mình có muốn đặt vé từ ${to}->${from} không ạ?"
Tuyệt đối không tự ý hỏi các thông tin đặt vé khác cho đến khi khách phản hồi về gợi ý khứ hồi này.`;
      }
    }
    
    this.conversationHistory = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n**THỜI GIAN HIỆN TẠI**: Hôm nay là ${dateStr}.${promptAddition}`
      }
    ];
  }

  async chat(userMessage: string): Promise<ChatResponse> {
    // Thêm tin nhắn của người dùng vào lịch sử
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    const toolCalls: ToolCallResult[] = [];

    try {
      // Gọi OpenAI với function calling
      let response = await getOpenAI().chat.completions.create({
        model: this.model,
        messages: this.conversationHistory,
        tools: tools as ChatCompletionTool[],
        tool_choice: 'auto',
        max_completion_tokens: 1000
      });

      let assistantMessage = response.choices[0].message;

      // Xử lý function calls (tool calls)
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Thêm assistant message vào history
        this.conversationHistory.push(assistantMessage);

        // Thực thi từng tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`🔧 Calling tool: ${functionName}`, functionArgs);

          let result;
          const validation = this.validatePickupLocation(functionName, functionArgs);
          if (!validation.valid) {
            result = validation.errorResult;
            console.log(`⚠️ Blocked defaulted pickup location for tool ${functionName}:`, result);
          } else {
            result = await executeTool(functionName, functionArgs, this.operatorId);
          }

          toolCalls.push({
            toolName: functionName,
            result
          });

          // Thêm kết quả tool vào history
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Gọi lại OpenAI để lấy response cuối cùng
        response = await getOpenAI().chat.completions.create({
          model: this.model,
          messages: this.conversationHistory,
          tools: tools as ChatCompletionTool[],
          tool_choice: 'auto',
          max_completion_tokens: 1000
        });

        assistantMessage = response.choices[0].message;
      }

      // Lấy nội dung trả lời cuối cùng
      const finalMessage = assistantMessage.content || '';

      // Thêm assistant message vào history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage
      });

      // Phân tích intent và trích xuất booking data nếu có
      const chatResponse = this.analyzeResponse(finalMessage, toolCalls);
      chatResponse.toolCalls = toolCalls;

      return chatResponse;

    } catch (error) {
      console.error('Error in chat:', error);
      return {
        message: 'Dạ xin lỗi, hệ thống đang gặp sự cố. Anh/chị vui lòng thử lại sau ạ.',
        needsEscalation: true
      };
    }
  }

  async *chatStream(userMessage: string): AsyncGenerator<{ type: 'text' | 'done' | 'tool', content?: string, data?: any }, void, unknown> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    let continueLoop = true;
    let loopCount = 0;
    const MAX_LOOPS = 8; // Tránh vòng lặp vô tận
    const toolCallsResults: ToolCallResult[] = [];

    try {
      while (continueLoop && loopCount < MAX_LOOPS) {
        loopCount++;

        // Lọc bỏ assistant message rỗng trước khi gửi lên API
        const cleanHistory = this.conversationHistory.filter((msg, idx) => {
          if (msg.role === 'assistant') {
            const m = msg as any;
            const hasContent = m.content && m.content.trim().length > 0;
            const hasToolCalls = m.tool_calls && m.tool_calls.length > 0;
            if (!hasContent && !hasToolCalls) {
              console.warn(`[chatStream] Skipping empty assistant message at index ${idx}`);
              return false;
            }
          }
          return true;
        });

        let responseStream: any;
        try {
          responseStream = await getOpenAI().chat.completions.create({
            model: this.model,
            messages: cleanHistory,
            tools: tools as ChatCompletionTool[],
            tool_choice: 'auto',
            max_completion_tokens: 1000,
            stream: true
          });
        } catch (apiErr: any) {
          console.error('[chatStream] OpenAI API error:', apiErr?.message);
          yield { type: 'text', content: 'Dạ xin lỗi, hệ thống đang bận. Anh/chị thử lại sau nhé ạ.' };
          yield { type: 'done', content: '' };
          return;
        }

        let toolCalls: any[] = [];
        let content = '';
        let finishReason = '';

        for await (const chunk of responseStream) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          const delta = choice.delta;
          finishReason = choice.finish_reason || finishReason;

          if (delta?.content) {
            content += delta.content;
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;
              if (!toolCalls[index]) {
                toolCalls[index] = { id: tc.id, function: { name: tc.function?.name || '', arguments: '' } };
              }
              if (tc.id && !toolCalls[index].id) toolCalls[index].id = tc.id;
              if (tc.function?.name && !toolCalls[index].function.name) toolCalls[index].function.name = tc.function.name;
              if (tc.function?.arguments) {
                toolCalls[index].function.arguments += tc.function.arguments;
              }
            }
          }
        }

        toolCalls = toolCalls.filter(tc => tc !== undefined && tc.function?.name);

        if (toolCalls.length > 0) {
          // Có tool calls → thực thi và tiếp tục vòng lặp
          this.conversationHistory.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments }
            }))
          } as any);

          for (const tc of toolCalls) {
            const functionName = tc.function.name;
            let functionArgs: any = {};
            try {
              functionArgs = JSON.parse(tc.function.arguments || '{}');
            } catch {
              console.error(`[chatStream] Failed to parse args for ${functionName}:`, tc.function.arguments);
            }

            console.log(`🔧 Calling tool in stream: ${functionName}`, functionArgs);

            let result;
            const validation = this.validatePickupLocation(functionName, functionArgs);
            if (!validation.valid) {
              result = validation.errorResult;
              console.log(`⚠️ Blocked defaulted pickup location in stream for tool ${functionName}:`, result);
            } else {
              result = await executeTool(functionName, functionArgs, this.operatorId);
            }

            toolCallsResults.push({ toolName: functionName, result });

            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result)
            });
          }

          continueLoop = true;

        } else if (content.trim().length > 0) {
          // Có nội dung text → kết thúc bình thường
          this.conversationHistory.push({
            role: 'assistant',
            content: content
          });

          const chatResponse = this.analyzeResponse(content, toolCallsResults);

          yield {
            type: 'done',
            content: content,
            data: {
              intent: chatResponse.intent,
              bookingData: chatResponse.bookingData,
              needsEscalation: chatResponse.needsEscalation
            }
          };

          continueLoop = false;

        } else {
          // Empty response — KHÔNG push vào history, fallback message
          console.warn(`[chatStream] Empty response on loop ${loopCount}, finish_reason=${finishReason}`);
          const fallback = 'Dạ xin lỗi, em chưa hiểu rõ câu hỏi của anh/chị. Anh/chị có thể hỏi lại được không ạ?';
          yield { type: 'text', content: fallback };
          yield { type: 'done', content: fallback };
          continueLoop = false;
        }
      }

      if (loopCount >= MAX_LOOPS) {
        console.warn('[chatStream] Max loops reached, forcing exit');
        yield { type: 'done', content: '' };
      }

    } catch (error) {
      console.error('Error in chatStream:', error);
      yield { type: 'text', content: 'Dạ xin lỗi, hệ thống đang gặp sự cố. Anh/chị thử lại sau nhé ạ.' };
      yield { type: 'done', content: '' };
    }
  }


  private analyzeResponse(message: string, toolCalls: ToolCallResult[]): ChatResponse {
    const response: ChatResponse = {
      message
    };

    // Phân tích intent từ tool calls
    for (const call of toolCalls) {
      switch (call.toolName) {
        case 'check_route_and_price':
          response.intent = 'price_inquiry';
          if (call.result.ticket_fee) {
            response.bookingData = {
              pickup: call.result.pickup?.suggested_point,
              dropoff: call.result.dropoff?.suggested_point,
              price: call.result.ticket_fee?.amount_vnd
            };
          }
          break;
        case 'get_departure_times':
          response.intent = 'schedule_inquiry';
          break;
        case 'collect_booking_info':
          response.intent = 'booking';
          response.bookingData = call.result;
          break;
        case 'handoff_to_cskh':
          response.intent = 'escalation';
          response.needsEscalation = true;
          break;
      }
    }

    // Check for escalation keywords
    if (message.includes('bộ phận chuyên trách') || message.includes('nhân viên tiếp nhận')) {
      response.needsEscalation = true;
    }

    return response;
  }

  resetConversation(): void {
    this.initializeConversation();
  }

  getConversationHistory(): ChatCompletionMessageParam[] {
    return this.conversationHistory;
  }

  private validatePickupLocation(functionName: string, functionArgs: any): { valid: boolean, errorResult?: any } {
    if (!['check_route_and_price', 'get_departure_times', 'collect_booking_info'].includes(functionName)) {
      return { valid: true };
    }

    const pickupArgs = ['pickup', 'from', 'pickup_location'];
    let pickupVal = '';
    for (const arg of pickupArgs) {
      if (functionArgs[arg]) {
        pickupVal = functionArgs[arg];
        break;
      }
    }
    
    if (!pickupVal) return { valid: true };
    
    const locLower = pickupVal.toLowerCase().trim();
    
    // Check if mentioned in user messages
    const userMessages = this.conversationHistory
      .filter(m => m.role === 'user')
      .map(m => {
        const content = m.content;
        if (typeof content === 'string') {
          return content.toLowerCase();
        } else if (Array.isArray(content)) {
          return content.map(part => ('text' in part ? part.text : '')).join(' ').toLowerCase();
        }
        return '';
      });
      
    const keywordsMap: Record<string, string[]> = {
      'hà nội': ['hà nội', 'ha noi', 'mỹ đình', 'my dinh', 'nội bài', 'noi bai', 'giáp bát', 'giap bat', 'nước ngầm', 'nuoc ngam', 'kim anh', 'bầu', 'nam hồng'],
      'tuyên quang': ['tuyên quang', 'tq', 'sơn dương', 'na hang', 'chiêm hóa', 'hàm yên'],
      'hà giang': ['hà giang', 'hg', 'xín mần', 'đồng văn', 'mèo vạc', 'hoàng su phì', 'yên minh', 'quản bạ', 'cốc pài'],
      'lào cai': ['lào cai', 'lc', 'sapa', 'bắc hà', 'phố lu', 'bảo hà'],
    };
    
    let matchKeywords: string[] = [locLower];
    for (const [key, val] of Object.entries(keywordsMap)) {
      if (locLower.includes(key) || key.includes(locLower)) {
        matchKeywords.push(...val);
      }
    }
    
    const mentioned = userMessages.some(content => matchKeywords.some(keyword => content.includes(keyword)));
    if (mentioned) return { valid: true };
    
    // Check if in booking history of userProfile
    if (this.userProfile?.bookingHistory) {
      for (const b of this.userProfile.bookingHistory) {
        const from = (b.from || b.pickup || '').toLowerCase();
        const to = (b.to || b.dropoff || '').toLowerCase();
        if (from.includes(locLower) || locLower.includes(from) || to.includes(locLower) || locLower.includes(to)) {
          return { valid: true };
        }
      }
    }
    
    // If not mentioned and not in history, it was defaulted by the AI
    return {
      valid: false,
      errorResult: {
        error: "missing_pickup_location",
        message: `Khách hàng chưa cung cấp điểm xuất phát (điểm đi) cụ thể. Bạn không được tự ý mặc định điểm đi là ${pickupVal}. Hãy hỏi lại khách hàng xem họ muốn đi từ đâu.`
      }
    };
  }
}

export default VuHanChatAgent;
