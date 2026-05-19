# Chatbot Nhà xe Vũ Hán

> **Đề tài**: Nghiên cứu và xây dựng chatbot hỗ trợ tư vấn và đặt vé cho nhà xe Vũ Hán dựa trên mô hình ngôn ngữ lớn (LLM) và function calling

## 🚌 Giới thiệu

Chatbot AI hỗ trợ khách hàng nhà xe Vũ Hán với các tính năng:
- **Hỏi giá vé**: Tra cứu giá vé theo tuyến và loại xe
- **Hỏi lịch chạy**: Xem các chuyến xe theo tuyến
- **Kiểm tra điểm đón/trả**: Xác nhận điểm đón có trong vùng phục vụ
- **Đặt vé**: Thu thập thông tin và hướng dẫn đặt vé
- **Gửi hàng**: Hướng dẫn gửi hàng qua văn phòng
- **Thông tin văn phòng**: Địa chỉ, số điện thoại các văn phòng
- **Chuyển CSKH**: Tự động chuyển nhân viên khi cần

## 🛠 Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **AI**: OpenAI GPT-4 với Function Calling
- **Cache**: Redis (optional)
- **Knowledge Store**: Markdown files

## 📁 Cấu trúc dự án

```
chatbot_project/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                    # Entry point
│   ├── agents/
│   │   ├── VuHanChatAgent.ts       # Agent chính
│   │   └── systemPrompt.ts         # System prompt
│   ├── tools/
│   │   ├── index.ts                # Tool definitions
│   │   ├── checkRouteAndPrice.ts   # Kiểm tra tuyến & giá
│   │   ├── getDepartureTimes.ts    # Lấy lịch chạy
│   │   ├── getETA.ts               # Tính thời gian dự kiến
│   │   ├── getOfficeInfo.ts        # Thông tin văn phòng
│   │   ├── collectBookingInfo.ts   # Thu thập thông tin đặt vé
│   │   ├── checkShippingInfo.ts    # Thông tin gửi hàng
│   │   └── handoffToCSKH.ts        # Chuyển CSKH
│   ├── api/
│   │   ├── chatRouter.ts           # Chat API
│   │   ├── routeRouter.ts          # Route validation API
│   │   └── healthRouter.ts         # Health check API
│   └── utils/
│       └── placeNormalizer.ts      # Chuẩn hóa địa điểm
└── knowledge/
    └── operators/
        └── vu_han/
            ├── operator.json
            ├── route/
            │   ├── ticket_fares.md
            │   └── route_timings.md
            ├── faq/
            │   └── general_faq.md
            └── common/
                └── offices.md
```

## 🚀 Cài đặt và chạy

### 1. Cài đặt dependencies

```bash
cd chatbot_project
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Sửa OPENAI_API_KEY trong file .env
```

### 3. Chạy development

```bash
npm run dev
```

### 4. Build và chạy production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Chat API

```bash
# Gửi tin nhắn
POST /api/chat
Content-Type: application/json

{
  "message": "Vé Hà Nội đi Mèo Vạc bao nhiêu?",
  "session_id": "user123"
}
```

### Route Validation API

```bash
# Kiểm tra tuyến và giá vé
POST /api/v1/operators/vu_han/route/validate
Content-Type: application/json

{
  "pickup": "Hà Nội",
  "dropoff": "Mèo Vạc",
  "vehicle": "bus"
}
```

### Schedule API

```bash
# Lấy lịch chạy
GET /api/v1/operators/vu_han/schedule?from=Hà Nội&to=Xín Mần
```

### Health Check

```bash
GET /healthz
GET /api/health
GET /api/health/openai
GET /api/health/knowledge
```

## 🧪 Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Hỏi giá vé | "Vé HN đi Mèo Vạc?" | "400k" |
| Hỏi lịch | "Xe đi Xín Mần mấy giờ?" | "5:30, 10:00, 19:20" |
| Điểm mơ hồ | "Tôi muốn đi Hà Giang" | Hỏi lại: Xín Mần/Đồng Văn/TP HG? |
| Alias | "Giá đi Cốc Pài?" | Nhận diện = Xín Mần, trả 300k |
| Ngoài vùng | "Đón ở TP Lào Cai?" | "Không vào, xuống Lu đón xe" |

## 📚 Tài liệu tham khảo

- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [API Documentation](../API.md)
- [BA Document](../BA_Chatbot_NhaXeVuHan.md)

## 📝 License

MIT License
