# Kế hoạch nâng cấp Chatbot sang kiến trúc Vector Database (RAG)

Kế hoạch này giúp chatbot Nhà xe Vũ Hán thông minh hơn bằng cách sử dụng sức mạnh ngữ nghĩa của Vector để tìm kiếm thông tin thay vì chỉ khớp từ khóa đơn thuần.

## Phase 1: Thực thi cài đặt & Cấu trúc (AI thực hiện)
- Cài đặt thư viện `compute-cosine-similarity` và `openai`.
- Thiết lập biến môi trường `EMBEDDING_MODEL` trong `.env`.

## Phase 2: AI Viết mã nguồn Vector Store
- Tạo mới file `src/utils/vectorStore.ts`: Viết logic tạo embedding và so sánh vector.
- Tích hợp hàm `cosineSimilarity` để tìm kết quả gần nhất.

## Phase 3: AI Viết Script Indexing (Huấn luyện)
- Tạo mới file `src/scripts/indexKnowledge.ts`.
- Viết mã tự động quét file `qa_pairs.json`, gọi API OpenAI để tạo vector và lưu vào `knowledge/vectors.json`.

## Phase 4: AI Cập nhật Hàng rào Logic (Sửa Code)
- Sửa code trong `KnowledgeService.ts`: Thay thế logic tìm kiếm cũ bằng `semanticSearchQA`.
- Sửa code trong `answerFAQ.ts`: Tích hợp tìm kiếm vector, xử lý trường hợp bot không chắc chắn.

## Phase 5: Verification (Kiểm thử & Tinh chỉnh)
- AI chạy test kiểm tra phản hồi của chatbot.
- Bạn (User) kiểm tra thực tế trên giao diện để confirm độ thông minh.

## Phase 5: Tinh chỉnh & Kiểm thử (Verification)
- Điều chỉnh Prompt để AI ưu tiên sử dụng thông tin từ Vector trả về.
- Kiểm thử các câu hỏi lái đi (thử sai chính tả, cách dùng từ khác).
