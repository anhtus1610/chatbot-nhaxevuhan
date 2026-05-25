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
const getKnowledgeRoot = (operatorId: string): string => {
  const rootEnv = process.env.KNOWLEDGE_ROOT;

  console.log('[KnowledgeRoot] DEBUG', {
    KNOWLEDGE_ROOT: rootEnv,
    cwd: process.cwd(),
    __dirname,
    operatorId,
  });;

  if (rootEnv) {
    const envRoot = path.resolve(process.cwd(), rootEnv);
    const envExists = fs.existsSync(envRoot);
    console.log(`[KnowledgeRoot] KNOWLEDGE_ROOT path: ${envRoot} | exists: ${envExists}`);
    if (envExists) return path.join(envRoot, 'operators', operatorId);
  }

  // Fallback 1: process.cwd()
  const cwdRoot = path.join(process.cwd(), 'knowledge');
  const cwdExists = fs.existsSync(cwdRoot);
  console.log(`[KnowledgeRoot] cwd fallback: ${cwdRoot} | exists: ${cwdExists}`);
  if (cwdExists) return path.join(cwdRoot, 'operators', operatorId);

  // Fallback 2: __dirname
  const dirRoot = path.join(__dirname, '../../../knowledge');
  const dirExists = fs.existsSync(dirRoot);
  console.log(`[KnowledgeRoot] __dirname fallback: ${dirRoot} | exists: ${dirExists}`);
  return path.join(dirRoot, 'operators', operatorId);
};

// Helper: Đảm bảo path không vượt ra ngoài thư mục gốc (path traversal prevention)
const resolveSafePath = (base: string, relative: string): string | null => {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base))) return null;
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

    console.log(`[knowledge/docs] resolved path: ${knowledgePath} | exists: ${fs.existsSync(knowledgePath)}`);

    if (!fs.existsSync(knowledgePath)) {
      return res.status(404).json({
        error: { code: 'operator_not_found', message: `Không tìm thấy operator: ${operator_id}` },
        // Debug info — xóa sau khi debug xong
        _debug: {
          resolvedPath: knowledgePath,
          cwd: process.cwd(),
          __dirname,
          KNOWLEDGE_ROOT: process.env.KNOWLEDGE_ROOT || null,
        },
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

    // Tạo backup trước khi ghi đè
    const backupPath = resolved + '.bak';
    fs.copyFileSync(resolved, backupPath);

    // Ghi nội dung mới (UTF-8)
    fs.writeFileSync(resolved, content, 'utf-8');

    const stat = fs.statSync(resolved);

    console.log(`[KnowledgeEditor] ✅ Updated: ${operator_id}/${filePath} — ${commit_message || 'no message'}`);

    res.json({
      success: true,
      operator_id,
      path: filePath,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      commit_message: commit_message || null,
      backup_created: true,
    });
  } catch (err) {
    console.error('[KnowledgeRouter] update doc error:', err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi hệ thống' } });
  }
});

export { router as knowledgeRouter };
