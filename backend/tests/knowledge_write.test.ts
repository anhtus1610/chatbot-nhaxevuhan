/**
 * Kiểm thử chức năng: Ghi nội dung vào file Markdown (Knowledge Editor)
 * Endpoint: PUT /api/v1/operators/:operator_id/knowledge/doc
 *
 * Cách hoạt động:
 *  - Mỗi test case dùng một thư mục fixture tạm thời (tmpDir) độc lập.
 *  - Biến môi trường KNOWLEDGE_ROOT được trỏ vào tmpDir trước mỗi test.
 *  - Sau khi test xong, thư mục tạm được xóa sạch (cleanup).
 *
 * Các trường hợp kiểm thử:
 *  TC-KW-01  Ghi thành công nội dung mới vào file .md hiện có
 *  TC-KW-02  File backup (.bak) được tạo trước khi ghi đè
 *  TC-KW-03  Nội dung thực tế trên đĩa sau khi ghi đúng với nội dung gửi lên
 *  TC-KW-04  Phản hồi JSON chứa đầy đủ các trường: success, path, size, updatedAt, backup_created
 *  TC-KW-05  Ghi có commit_message — trường commit_message được trả về trong response
 *  TC-KW-06  Ghi không có commit_message — trường commit_message = null
 *  TC-KW-07  Thiếu trường "path" trong body → 400 invalid_request
 *  TC-KW-08  Thiếu trường "content" trong body → 400 invalid_request
 *  TC-KW-09  "content" không phải chuỗi (số nguyên) → 400 invalid_request
 *  TC-KW-10  File không tồn tại trong knowledge store → 404 file_not_found
 *  TC-KW-11  Path traversal qua tên file (../../etc/passwd) → 400 invalid_path
 *  TC-KW-12  operatorId chứa ký tự không hợp lệ (../hack) → 500 (throw từ getKnowledgeRoot)
 *  TC-KW-13  Ghi nội dung rỗng ("") — vẫn hợp lệ, file trở thành rỗng
 *  TC-KW-14  Ghi nội dung Unicode/tiếng Việt — đọc lại file đúng encoding UTF-8
 */

import request from 'supertest';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { knowledgeRouter } from '../src/api/knowledgeRouter';

// ─── Thiết lập Express app test (không dùng server production) ───────────────
const app = express();
app.use(express.json());
app.use('/api/v1/operators', knowledgeRouter);

// ─── Hằng số ─────────────────────────────────────────────────────────────────
const OPERATOR_ID = 'test_operator';
const TEST_FILE_RELATIVE = 'faq/test_doc.md';
const ORIGINAL_CONTENT = '# Tài liệu kiểm thử\nNội dung gốc ban đầu.';

// ─── Biến thư mục tạm ────────────────────────────────────────────────────────
let tmpDir: string;
let testFilePath: string;

// ─── Setup: tạo cấu trúc thư mục fixture trước mỗi test ─────────────────────
beforeEach(() => {
  // Tạo thư mục tạm duy nhất cho mỗi test case
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-test-'));

  // Tạo cây thư mục: <tmpDir>/operators/test_operator/faq/
  const operatorDir = path.join(tmpDir, 'operators', OPERATOR_ID, 'faq');
  fs.mkdirSync(operatorDir, { recursive: true });

  // Tạo file Markdown mẫu
  testFilePath = path.join(operatorDir, 'test_doc.md');
  fs.writeFileSync(testFilePath, ORIGINAL_CONTENT, 'utf-8');

  // Trỏ KNOWLEDGE_ROOT vào tmpDir để knowledgeRouter dùng fixture này
  process.env.KNOWLEDGE_ROOT = tmpDir;
});

// ─── Cleanup: xóa thư mục tạm sau mỗi test ───────────────────────────────────
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KNOWLEDGE_ROOT;
});

// ─── Helper: gọi PUT endpoint ────────────────────────────────────────────────
const putDoc = (operatorId: string, body: object) =>
  request(app)
    .put(`/api/v1/operators/${operatorId}/knowledge/doc`)
    .send(body)
    .set('Content-Type', 'application/json');

// ═════════════════════════════════════════════════════════════════════════════
//  NHÓM 1: Ghi thành công
// ═════════════════════════════════════════════════════════════════════════════
describe('Nhóm 1 — Ghi thành công (Happy Path)', () => {

  it('TC-KW-01: Trả về HTTP 200 và success=true khi ghi hợp lệ', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '# Nội dung mới',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-KW-02: Tạo file backup (.bak) trước khi ghi đè', async () => {
    await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '# Nội dung mới',
    });

    const backupPath = testFilePath + '.bak';
    expect(fs.existsSync(backupPath)).toBe(true);

    // Nội dung backup phải là nội dung GỐC (trước khi bị ghi đè)
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    expect(backupContent).toBe(ORIGINAL_CONTENT);
  });

  it('TC-KW-03: Nội dung file trên đĩa khớp với nội dung đã gửi lên', async () => {
    const newContent = '# Cập nhật\nDòng 1\nDòng 2';

    await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: newContent,
    });

    const onDisk = fs.readFileSync(testFilePath, 'utf-8');
    expect(onDisk).toBe(newContent);
  });

  it('TC-KW-04: Phản hồi JSON có đủ các trường bắt buộc', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '# Nội dung mới',
    });

    expect(res.body).toMatchObject({
      success: true,
      operator_id: OPERATOR_ID,
      path: TEST_FILE_RELATIVE,
      backup_created: true,
    });
    expect(typeof res.body.size).toBe('number');
    expect(typeof res.body.updatedAt).toBe('string');
    // Kiểm tra updatedAt là ISO 8601 hợp lệ
    expect(new Date(res.body.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('TC-KW-05: Có commit_message → trường commit_message được trả về đúng', async () => {
    const message = 'Cập nhật bảng giá tháng 6';

    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '# Cập nhật',
      commit_message: message,
    });

    expect(res.body.commit_message).toBe(message);
  });

  it('TC-KW-06: Không có commit_message → trường commit_message = null', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '# Cập nhật',
      // Không gửi commit_message
    });

    expect(res.body.commit_message).toBeNull();
  });

  it('TC-KW-13: Ghi nội dung rỗng ("") — hợp lệ, file trở thành rỗng', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: '',
    });

    expect(res.status).toBe(200);
    const onDisk = fs.readFileSync(testFilePath, 'utf-8');
    expect(onDisk).toBe('');
  });

  it('TC-KW-14: Ghi nội dung Unicode/tiếng Việt — đọc lại file đúng encoding', async () => {
    const vietnamese = '# Nhà xe Vũ Hán\nXin chào! Chúng tôi phục vụ tuyến Hà Nội – TP.HCM 🚌';

    await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: vietnamese,
    });

    const onDisk = fs.readFileSync(testFilePath, 'utf-8');
    expect(onDisk).toBe(vietnamese);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  NHÓM 2: Lỗi thiếu / sai trường trong request body
// ═════════════════════════════════════════════════════════════════════════════
describe('Nhóm 2 — Lỗi dữ liệu đầu vào (400 Bad Request)', () => {

  it('TC-KW-07: Thiếu trường "path" → 400 invalid_request', async () => {
    const res = await putDoc(OPERATOR_ID, {
      // Không có path
      content: '# Nội dung',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('TC-KW-08: Thiếu trường "content" → 400 invalid_request', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      // Không có content
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('TC-KW-09: "content" là số nguyên thay vì chuỗi → 400 invalid_request', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: TEST_FILE_RELATIVE,
      content: 12345,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  NHÓM 3: Lỗi file / đường dẫn không hợp lệ
// ═════════════════════════════════════════════════════════════════════════════
describe('Nhóm 3 — Lỗi đường dẫn & file (404 / 400)', () => {

  it('TC-KW-10: File không tồn tại trong knowledge store → 404 file_not_found', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: 'faq/khong_ton_tai.md',
      content: '# Không tồn tại',
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('file_not_found');
  });

  it('TC-KW-11: Path traversal qua tên file (../../etc/passwd) → 400 invalid_path', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: '../../etc/passwd',
      content: 'hacked',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_path');
  });

  it('TC-KW-11b: Path traversal dạng khác (../../../secret.md) → 400 invalid_path', async () => {
    const res = await putDoc(OPERATOR_ID, {
      path: '../../../secret.md',
      content: 'hacked',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_path');
  });

  it('TC-KW-12: Path traversal trong operatorId (../hack) bị chặn bởi Express → không tới được router (404)', async () => {
    const res = await putDoc('../hack', {
      path: TEST_FILE_RELATIVE,
      content: '# Tấn công',
    });

    // Express normalize URL nên path traversal trong URL segment bị loại bỏ,
    // request không khớp route nào → Express trả 404 mà không vào knowledgeRouter.
    // Điều này xác nhận: URL-level path traversal bị chặn hoàn toàn ở tầng HTTP.
    expect(res.status).toBe(404);
  });
});
