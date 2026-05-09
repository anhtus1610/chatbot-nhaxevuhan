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

  constructor(operatorId: string = 'vu_han') {
    this.operatorId = operatorId;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
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
    
    this.conversationHistory = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n**THỜI GIAN HIỆN TẠI**: Hôm nay là ${dateStr}.`
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

          const result = await executeTool(functionName, functionArgs, this.operatorId);

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
    const toolCallsResults: ToolCallResult[] = [];

    try {
      while (continueLoop) {
        const responseStream = await getOpenAI().chat.completions.create({
          model: this.model,
          messages: this.conversationHistory,
          tools: tools as ChatCompletionTool[],
          tool_choice: 'auto',
          max_completion_tokens: 1000,
          stream: true
        });

        let toolCalls: any[] = [];
        let content = '';

        for await (const chunk of responseStream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            content += delta.content;
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;
              if (!toolCalls[index]) {
                toolCalls[index] = { id: tc.id, function: { name: tc.function?.name, arguments: '' } };
              }
              if (tc.function?.arguments) {
                toolCalls[index].function.arguments += tc.function.arguments;
              }
            }
          }
        }

        toolCalls = toolCalls.filter(tc => tc !== undefined);

        if (toolCalls.length > 0) {
          this.conversationHistory.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: tc.function
            }))
          } as any);

          for (const tc of toolCalls) {
            const functionName = tc.function.name;
            const functionArgs = JSON.parse(tc.function.arguments);

            console.log(`🔧 Calling tool in stream: ${functionName}`, functionArgs);
            
            const result = await executeTool(functionName, functionArgs, this.operatorId);

            toolCallsResults.push({
              toolName: functionName,
              result
            });

            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result)
            });
          }

          continueLoop = true;
        } else {
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
        }
      }
    } catch (error) {
      console.error('Error in chatStream:', error);
      yield { type: 'text', content: 'Dạ xin lỗi, hệ thống đang gặp sự cố.' };
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
}

export default VuHanChatAgent;
