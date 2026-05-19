# Danh sách chuẩn bị nâng cấp Vector Database (RAG)

Để hệ thống chatbot Nhà xe Vũ Hán chuyển sang dùng kiến trúc Vector Database thành công, bạn cần chuẩn bị các mục sau:

## 1. Tài khoản & API Key
- **OpenAI API Key**: Phải còn số dư (credit) để gọi model `text-embedding-3-small`. 
- Kiểm tra file `.env` ở backend, đảm bảo biến `OPENAI_API_KEY` đã chính xác.

## 2. Chuẩn bị Dữ liệu (Data Cleaning)
- **qa_pairs.json**: Kiểm tra lại file này trong thư mục `knowledge`. 
- Đảm bảo các câu hỏi (`question`) không quá ngắn và các câu trả lời (`answer`) đầy đủ thông tin. Vector tìm kiếm dựa trên ngữ nghĩa của toàn bộ câu.

## 3. Môi trường Node.js
- Đảm bảo bạn đang dùng Node.js phiên bản từ **18.x** trở lên để hỗ trợ các thư viện xử lý vector hiện đại.
- Cần quyền ghi vào thư mục `knowledge` để chatbot có thể tạo file cache vector (`embeddings.json`).

## 4. Cài đặt thư viện mới (Sẽ được thực hiện trong Phase 1)
- `openai`: Đã có sẵn.
- `cosine-similarity`: Thư viện tính toán độ tương đồng giữa các vector.
- `fuse.js`: (Tùy chọn) Để kết hợp tìm kiếm mờ (Fuzzy Search) cùng với Vector.

---
*Lưu ý: Bạn không cần cài đặt thêm server Database riêng biệt (như Pinecone hay Milvus), mình sẽ hướng dẫn bạn dùng giải pháp Vector Store cục bộ để tiết kiệm chi phí và dễ quản lý.*
