# Chatbot Nhà xe Vũ Hán

Dự án chatbot hỗ trợ tư vấn và đặt vé cho nhà xe Vũ Hán sử dụng LLM và Function Calling.

## 📁 Cấu trúc dự án

```
chatbot_project/
├── backend/          # Express.js API Server
│   ├── src/
│   │   ├── agents/   # Chatbot Agent với OpenAI
│   │   ├── tools/    # Function Calling Tools
│   │   ├── api/      # REST API Routes
│   │   └── utils/    # Utilities
│   └── knowledge/    # Knowledge Base (Markdown)
│
├── frontend/         # Route Console (Vite + React)
│   └── src/
│       ├── pages/    # Pages (RouteChecker, ScheduleViewer, ChatTester)
│       └── services/ # API Client
│
├── widget/           # Embeddable Chat Widget
│   └── src/
│       ├── components/ # ChatWidget component
│       └── hooks/      # useChat hook
│
└── README.md
```

## 🚀 Cách chạy

### 1. Backend (Port 14556)

```bash
cd backend
npm install
cp .env.example .env
# Sửa OPENAI_API_KEY trong .env
npm run dev
```

### 2. Frontend - Route Console (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

### 3. Widget - Chat Widget (Port 5174)

```bash
cd widget
npm install
npm run dev
```

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Express.js + TypeScript |
| LLM | OpenAI GPT-4 với Function Calling |
| Frontend | Vite + React + TypeScript |
| Widget | Vite + React (Embeddable) |
| Knowledge | Markdown files |

## 📚 API Endpoints

### Chat API
- `POST /api/chat` - Gửi tin nhắn và nhận phản hồi
- `DELETE /api/chat/:session_id` - Reset session

### Route API  
- `POST /api/v1/operators/:operator_id/route/validate` - Kiểm tra tuyến
- `POST /api/v1/operators/:operator_id/route/time` - Tính thời gian
- `GET /api/v1/operators/:operator_id/schedule` - Lấy lịch chạy

### Health API
- `GET /api/health` - Health check
- `GET /api/health/openai` - Check OpenAI config
- `GET /api/health/knowledge` - Check knowledge base

## 🤖 Function Calling Tools

1. **check_route_and_price** - Kiểm tra tuyến và giá vé
2. **get_departure_times** - Lấy lịch chạy xe
3. **get_eta** - Tính thời gian dự kiến
4. **get_office_info** - Lấy thông tin văn phòng
5. **collect_booking_info** - Thu thập thông tin đặt vé
6. **check_shipping_info** - Thông tin gửi hàng
7. **handoff_to_cskh** - Chuyển CSKH

## 📝 Tính năng chính

- ✅ Tư vấn thông tin xe (giờ chạy, giá vé, điểm đón/trả)
- ✅ Hỗ trợ đặt vé với thu thập thông tin tự động
- ✅ Trả lời FAQ dựa trên knowledge base
- ✅ Chuẩn hóa địa điểm với Vietnamese aliases
- ✅ Xử lý điểm đặc biệt (Hà Giang mơ hồ, Vĩnh Phúc cao tốc...)
- ✅ Chuyển CSKH khi cần hỗ trợ đặc biệt
- ✅ Widget chat có thể embed vào website

## 📞 Liên hệ

- **Hotline**: 0912 037 237
- **Zalo OA**: Xe khách Vũ Hán (tích vàng)
- **Fanpage**: facebook.com/vuhangroup
