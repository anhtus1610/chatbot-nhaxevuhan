/**
 * Knowledge Editor API Router
 * Cho phép team vận hành đọc và cập nhật các file Markdown
 * trong Knowledge Store mà không cần redeploy code.
 *
 * Endpoints:
 *  GET  /:operator_id/knowledge/docs
 *  GET  /:operator_id/knowledge/doc?path=route/xxx.md
 *  PUT  /:operator_id/knowledge/doc
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Helper: Lấy đường dẫn gốc của knowledge store
// Lưu ý: trên Vercel, process.cwd() = /var/task (root của repo), không phải thư mục backend/
const getKnowledgeRoot = (operatorId: string): string => {
  // BẢO MẬT: Chặn Path Traversal thông qua operatorId (ngăn chặn các ký tự lạ như ../, *, v.v.)
  if (!/^[a-zA-Z0-9_-]+$/.test(operatorId)) {
    throw new Error('Invalid operatorId format');
  }

  const rootEnv = process.env.KNOWLEDGE_ROOT;

  if (rootEnv) {
    const envRoot = path.resolve(process.cwd(), rootEnv);
    if (fs.existsSync(envRoot)) return path.join(envRoot, 'operators', operatorId);
  }

  // Fallback 1: process.cwd()
  const cwdRoot = path.join(process.cwd(), 'knowledge');
  if (fs.existsSync(cwdRoot)) return path.join(cwdRoot, 'operators', operatorId);

  // Fallback 2: __dirname
  const dirRoot = path.join(__dirname, '../../../knowledge');
  return path.join(dirRoot, 'operators', operatorId);
};

// Helper: Đảm bảo path không vượt ra ngoài thư mục gốc (path traversal prevention)
const resolveSafePath = (base: string, relative: string): string | null => {
  const resolved = path.resolve(base, relative);
  const relativeFromBase = path.relative(base, resolved);
  // Ensure the relative path does not start with '..' and is not absolute
  if (relativeFromBase.startsWith('..') || path.isAbsolute(relativeFromBase)) {
    return null;
  }
  return resolved;
};

// Helper: Liệt kê đệ quy tất cả file .md trong một thư mục
const listMarkdownFiles = (dir: string, base: string): { path: string; name: string; folder: string; size: number; updatedAt: string }[] => {
  const results: { path: string; name: string; folder: string; size: number; updatedAt: string }[] = [];

  const walk = (current: string) => {
    if (!fs.existsSync(current)) return;
    const items = fs.readdirSync(current);
    for (const item of items) {
      const fullPath = path.join(current, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.md')) {
        const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');
        const folder = path.dirname(relativePath);
        results.push({
          path: relativePath,
          name: item,
          folder: folder === '.' ? 'root' : folder,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        });
      }
    }
  };

  walk(dir);
  return results.sort((a, b) => a.path.localeCompare(b.path, 'vi'));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /:operator_id/knowledge/docs  — Liệt kê tất cả file .md
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:operator_id/knowledge/docs', (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const knowledgePath = getKnowledgeRoot(operator_id);

    if (!fs.existsSync(knowledgePath)) {
      return res.status(404).json({
        error: { code: 'operator_not_found', message: `Không tìm thấy operator: ${operator_id}` },
      });
    }

    const docs = listMarkdownFiles(knowledgePath, knowledgePath);

    // Đọc operator.json nếu có
    let operatorMeta: Record<string, unknown> = {};
    const metaPath = path.join(knowledgePath, 'operator.json');
    if (fs.existsSync(metaPath)) {
      operatorMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    res.json({
      operator_id,
      operator_name: (operatorMeta as { name?: string }).name || operator_id,
      total_docs: docs.length,
      docs,
    });
  } catch (err) {
    console.error('[KnowledgeRouter] list docs error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:operator_id/knowledge/doc?path=route/ticket_fares.md — Đọc nội dung file
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:operator_id/knowledge/doc', (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({
        error: { code: 'invalid_request', message: 'Thiếu query param "path"' },
      });
    }

    const base = getKnowledgeRoot(operator_id);
    const resolved = resolveSafePath(base, filePath);

    if (!resolved) {
      return res.status(400).json({
        error: { code: 'invalid_path', message: 'Đường dẫn file không hợp lệ' },
      });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({
        error: { code: 'file_not_found', message: `Không tìm thấy file: ${filePath}` },
      });
    }

    const stat = fs.statSync(resolved);
    const content = fs.readFileSync(resolved, 'utf-8');

    res.json({
      operator_id,
      path: filePath,
      name: path.basename(filePath),
      content,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    console.error('[KnowledgeRouter] read doc error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:operator_id/knowledge/doc — Cập nhật nội dung file
// Body: { path: string, content: string, commit_message?: string }
// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache để lưu tạm nội dung file khi chạy trên Vercel (filesystem read-only)
// Trên Vercel: /var/task là read-only nên không thể writeFileSync thật sự
const memoryCache = new Map<string, { content: string; updatedAt: string }>();

router.put('/:operator_id/knowledge/doc', (req: Request, res: Response) => {
  try {
    const { operator_id } = req.params;
    const { path: filePath, content, commit_message } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({
        error: { code: 'invalid_request', message: 'Thiếu "path" hoặc "content"' },
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        error: { code: 'invalid_request', message: '"content" phải là chuỗi văn bản' },
      });
    }

    const base = getKnowledgeRoot(operator_id);
    const resolved = resolveSafePath(base, filePath);

    if (!resolved) {
      return res.status(400).json({
        error: { code: 'invalid_path', message: 'Đường dẫn file không hợp lệ' },
      });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({
        error: { code: 'file_not_found', message: `Không tìm thấy file: ${filePath}` },
      });
    }

    const cacheKey = `${operator_id}/${filePath}`;
    const updatedAt = new Date().toISOString();

    try {
      // Thử ghi vào filesystem (hoạt động khi chạy local)
      const backupPath = resolved + '.bak';
      fs.copyFileSync(resolved, backupPath);
      fs.writeFileSync(resolved, content, 'utf-8');
      const stat = fs.statSync(resolved);

      // Lưu vào cache để read cũng nhất quán
      memoryCache.set(cacheKey, { content, updatedAt: stat.mtime.toISOString() });

      console.log(`[KnowledgeEditor] ✅ Updated (disk): ${operator_id}/${filePath} — ${commit_message || 'no message'}`);

      res.json({
        success: true,
        operator_id,
        path: filePath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        commit_message: commit_message || null,
        backup_created: true,
        storage: 'disk',
      });
    } catch (writeErr: any) {
      // Trên Vercel: filesystem read-only (EROFS) → dùng in-memory cache
      if (writeErr.code === 'EROFS' || writeErr.code === 'EACCES' || process.env.VERCEL === '1') {
        memoryCache.set(cacheKey, { content, updatedAt });

        console.log(`[KnowledgeEditor] ✅ Updated (memory): ${operator_id}/${filePath} — ${commit_message || 'no message'}`);

        const encoder = new TextEncoder();
        res.json({
          success: true,
          operator_id,
          path: filePath,
          size: encoder.encode(content).length,
          updatedAt,
          commit_message: commit_message || null,
          backup_created: false,
          storage: 'memory',
          note: 'Vercel serverless: lưu tạm trong bộ nhớ (reset khi redeploy)',
        });
      } else {
        throw writeErr;
      }
    }
  } catch (err) {
    console.error('[KnowledgeRouter] update doc error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống khi lưu file' } });
  }
});

// Override GET để trả về từ memory cache nếu có (nhất quán với write)
router.get('/:operator_id/knowledge/doc/cached', (req: Request, res: Response) => {
  const { operator_id } = req.params;
  const filePath = req.query.path as string;
  const cacheKey = `${operator_id}/${filePath}`;

  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey)!;
    return res.json({
      operator_id,
      path: filePath,
      content: cached.content,
      updatedAt: cached.updatedAt,
      source: 'memory_cache',
    });
  }

  res.status(404).json({ error: { code: 'not_in_cache', message: 'Không có trong cache' } });
});

export { router as knowledgeRouter };

