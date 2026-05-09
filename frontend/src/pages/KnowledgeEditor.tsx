import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Folder, Save, RefreshCw, CheckCircle, AlertCircle, Loader, Edit3, ChevronRight } from 'lucide-react'
import {
  listKnowledgeDocs,
  getKnowledgeDoc,
  updateKnowledgeDoc,
  type KnowledgeDocMeta,
} from '../services/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FolderGroup {
  name: string
  files: KnowledgeDocMeta[]
  isOpen: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Helper ──────────────────────────────────────────────────────────────────

const FOLDER_LABELS: Record<string, string> = {
  route: '🛣 Tuyến & Giá vé',
  faq: '❓ Câu hỏi thường gặp',
  common: '📋 Thông tin chung',
  root: '📁 Gốc',
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeEditor() {
  const [folders, setFolders] = useState<FolderGroup[]>([])
  const [selectedFile, setSelectedFile] = useState<KnowledgeDocMeta | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [commitMsg, setCommitMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [fileLoading, setFileLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = content !== originalContent

  // ── Load danh sách file ──────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await listKnowledgeDocs('vu_han')
      // Group theo folder
      const groupMap: Record<string, KnowledgeDocMeta[]> = {}
      for (const doc of data.docs) {
        if (!groupMap[doc.folder]) groupMap[doc.folder] = []
        groupMap[doc.folder].push(doc)
      }
      const folderOrder = ['route', 'faq', 'common', 'root']
      const groups = Object.keys(groupMap)
        .sort((a, b) => {
          const ia = folderOrder.indexOf(a)
          const ib = folderOrder.indexOf(b)
          if (ia === -1 && ib === -1) return a.localeCompare(b)
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
        .map(folder => ({ name: folder, files: groupMap[folder], isOpen: true }))
      setFolders(groups)
    } catch {
      setErrorMsg('Không thể tải danh sách file. Hãy kiểm tra backend đang chạy.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  // ── Chọn file để đọc ────────────────────────────────────────────────────
  const handleSelectFile = async (file: KnowledgeDocMeta) => {
    if (isDirty && selectedFile) {
      const ok = window.confirm('Bạn có thay đổi chưa lưu. Tiếp tục sẽ mất thay đổi đó — bạn có muốn tiếp tục không?')
      if (!ok) return
    }
    setSelectedFile(file)
    setFileLoading(true)
    setSaveStatus('idle')
    setErrorMsg('')
    try {
      const doc = await getKnowledgeDoc('vu_han', file.path)
      setContent(doc.content)
      setOriginalContent(doc.content)
      setUpdatedAt(doc.updatedAt)
      setCommitMsg('')
      setTimeout(() => textareaRef.current?.focus(), 100)
    } catch {
      setErrorMsg(`Không thể đọc file: ${file.path}`)
    } finally {
      setFileLoading(false)
    }
  }

  // ── Lưu file ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedFile || !isDirty) return
    setSaveStatus('saving')
    setErrorMsg('')
    try {
      const result = await updateKnowledgeDoc('vu_han', selectedFile.path, content, commitMsg || undefined)
      setOriginalContent(content)
      setUpdatedAt(result.updatedAt)
      setSaveStatus('saved')
      // Cập nhật lại kích thước file trong danh sách
      setFolders(prev =>
        prev.map(f => ({
          ...f,
          files: f.files.map(file =>
            file.path === selectedFile.path
              ? { ...file, size: new Blob([content]).size, updatedAt: result.updatedAt }
              : file
          ),
        }))
      )
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setErrorMsg('Lưu file thất bại. Kiểm tra backend và thử lại.')
    }
  }

  // ── Keyboard shortcut Ctrl+S ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const toggleFolder = (name: string) => {
    setFolders(prev => prev.map(f => f.name === name ? { ...f, isOpen: !f.isOpen } : f))
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ke-layout">

      {/* ── Sidebar danh sách file ── */}
      <aside className="ke-sidebar">
        <div className="ke-sidebar-header">
          <div className="ke-sidebar-title">
            <Edit3 size={18} />
            <span>Quản lý tri thức</span>
          </div>
          <button className="icon-btn" onClick={loadDocs} title="Làm mới danh sách">
            <RefreshCw size={16} className={loading ? 'ke-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="ke-loading-state">
            <Loader size={20} className="ke-spin" />
            <span>Đang tải...</span>
          </div>
        ) : errorMsg && folders.length === 0 ? (
          <div className="ke-error-state">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="ke-file-tree">
            {folders.map(folder => (
              <div key={folder.name} className="ke-folder">
                <button
                  className="ke-folder-header"
                  onClick={() => toggleFolder(folder.name)}
                >
                  <ChevronRight
                    size={14}
                    className={`ke-chevron ${folder.isOpen ? 'open' : ''}`}
                  />
                  <Folder size={14} />
                  <span>{FOLDER_LABELS[folder.name] || folder.name}</span>
                  <span className="ke-badge">{folder.files.length}</span>
                </button>

                {folder.isOpen && (
                  <div className="ke-file-list">
                    {folder.files.map(file => (
                      <button
                        key={file.path}
                        className={`ke-file-item ${selectedFile?.path === file.path ? 'active' : ''}`}
                        onClick={() => handleSelectFile(file)}
                      >
                        <FileText size={13} />
                        <span className="ke-file-name">{file.name}</span>
                        <span className="ke-file-size">{formatBytes(file.size)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ── Editor Panel ── */}
      <main className="ke-editor">
        {!selectedFile ? (
          <div className="ke-empty-state">
            <FileText size={48} strokeWidth={1} />
            <h3>Chọn một file để chỉnh sửa</h3>
            <p>Các file Markdown trong Knowledge Store hiển thị ở bên trái. Chatbot sẽ dùng dữ liệu này để trả lời khách hàng.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="ke-toolbar">
              <div className="ke-toolbar-info">
                <span className="ke-file-path">{selectedFile.path}</span>
                {updatedAt && (
                  <span className="ke-last-updated">Cập nhật lúc: {formatDate(updatedAt)}</span>
                )}
                {isDirty && <span className="ke-dirty-indicator">● Chưa lưu</span>}
              </div>

              <div className="ke-toolbar-actions">
                <input
                  className="ke-commit-input"
                  type="text"
                  placeholder="Ghi chú thay đổi (tuỳ chọn)"
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                />
                <button
                  className={`btn btn-primary ke-save-btn ${!isDirty || saveStatus === 'saving' ? 'disabled' : ''}`}
                  onClick={handleSave}
                  disabled={!isDirty || saveStatus === 'saving'}
                  title="Lưu (Ctrl+S)"
                >
                  {saveStatus === 'saving' ? (
                    <><Loader size={16} className="ke-spin" /> Đang lưu...</>
                  ) : saveStatus === 'saved' ? (
                    <><CheckCircle size={16} /> Đã lưu!</>
                  ) : (
                    <><Save size={16} /> Lưu lại</>
                  )}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="ke-error-banner">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Textarea */}
            {fileLoading ? (
              <div className="ke-file-loading">
                <Loader size={24} className="ke-spin" />
                <span>Đang tải nội dung...</span>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="ke-textarea"
                value={content}
                onChange={e => setContent(e.target.value)}
                spellCheck={false}
                placeholder="Nội dung file Markdown..."
              />
            )}

            {/* Footer */}
            <div className="ke-footer">
              <span>{content.split('\n').length} dòng · {formatBytes(new Blob([content]).size)}</span>
              <span>Markdown · UTF-8</span>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
