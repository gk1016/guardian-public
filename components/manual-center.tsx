"use client";

import { useState, useTransition, useRef, DragEvent } from "react";
import {
  Filter,
  FileText,
  Download,
  Trash2,
  Plus,
  BookOpen,
  Upload,
  LoaderCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type ManualItem = {
  id: string;
  title: string;
  category: string;
  entryType: string;
  body: string;
  bodyPreview: string;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  createdAt: string;
  updatedAt: string;
  authorDisplay: string;
};

type ManualCenterProps = {
  initialItems: ManualItem[];
  canAuthor: boolean;
};

const categoryLabel: Record<string, string> = {
  general: "General",
  sop: "SOP",
  procedures: "Procedures",
  training: "Training",
  reference: "Reference",
  guides: "Guides",
};

const categoryBadge: Record<string, string> = {
  general: "border-slate-400/20 bg-slate-400/8 text-slate-300",
  sop: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  procedures: "border-cyan-400/20 bg-cyan-400/8 text-cyan-200",
  training: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200",
  reference: "border-purple-400/20 bg-purple-400/8 text-purple-200",
  guides: "border-blue-400/20 bg-blue-400/8 text-blue-200",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Check if the body content looks like HTML (from mammoth docx extraction). */
function isHtmlContent(body: string): boolean {
  return body.startsWith("<") && (body.includes("<p>") || body.includes("<h") || body.includes("<table"));
}

type CategoryFilter = "all" | "general" | "sop" | "procedures" | "training" | "reference" | "guides";

export function ManualCenter({ initialItems, canAuthor }: ManualCenterProps) {
  const [items, setItems] = useState<ManualItem[]>(initialItems);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createMode, setCreateMode] = useState<"article" | "file">("article");
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newBody, setNewBody] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);

  const filtered = categoryFilter === "all"
    ? items
    : items.filter((i) => i.category === categoryFilter);

  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
  ];

  function validateAndSetFile(file: File | null) {
    setUploadError(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10MB limit.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedExts = ["pdf", "docx", "doc", "txt", "md", "png", "jpg", "jpeg"];
    if (!allowedMimeTypes.includes(file.type) && (!ext || !allowedExts.includes(ext))) {
      setUploadError(`File type not allowed: ${file.type || ext}`);
      return;
    }
    setNewFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(file);
  }

  function handleCreate() {
    if (!newTitle.trim()) return;
    setUploadError(null);
    startTransition(async () => {
      try {
        if (createMode === "article") {
          const res = await fetch("/api/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newTitle,
              category: newCategory,
              body: newBody,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setUploadError(data.error ?? `Server error: ${res.status}`);
            return;
          }
          const listRes = await fetch("/api/manual");
          const data = await listRes.json();
          if (data.ok) setItems(data.items);
          setNewTitle("");
          setNewBody("");
          setShowCreateForm(false);
        } else {
          if (!newFile) return;
          const formData = new FormData();
          formData.append("title", newTitle);
          formData.append("category", newCategory);
          formData.append("file", newFile);
          const res = await fetch("/api/manual", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setUploadError(data.error ?? `Upload failed: ${res.status}`);
            return;
          }
          const listRes = await fetch("/api/manual");
          const data = await listRes.json();
          if (data.ok) setItems(data.items);
          setNewTitle("");
          setNewFile(null);
          setShowCreateForm(false);
        }
      } catch (err) {
        setUploadError(`Network error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/manual/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (expandedId === id) setExpandedId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <BookOpen size={14} className="text-[var(--color-accent)]" />
            <span>{filtered.length} entries</span>
          </div>
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-[var(--color-text-tertiary)]" />
            {(["all", "sop", "procedures", "training", "reference", "guides", "general"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  categoryFilter === f
                    ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {canAuthor ? (
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-400/20 bg-amber-400/8 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-400/15"
          >
            <Plus size={12} />
            New entry
          </button>
        ) : null}
      </div>

      {/* Create form */}
      {showCreateForm && canAuthor ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5 panel-elevated">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
            <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-[var(--color-text-strong)]">New Entry</p>
            <div className="flex gap-1">
              <button
                onClick={() => setCreateMode("article")}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  createMode === "article" ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                <FileText size={11} className="mr-1 inline" />
                Article
              </button>
              <button
                onClick={() => setCreateMode("file")}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  createMode === "file" ? "bg-[var(--color-overlay-strong)] text-[var(--color-text-strong)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                <Upload size={11} className="mr-1 inline" />
                File Upload
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Entry title"
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 text-sm text-[var(--color-text-strong)] focus:border-amber-400/40 focus:outline-none"
              >
                <option value="general">General</option>
                <option value="sop">SOP</option>
                <option value="procedures">Procedures</option>
                <option value="training">Training</option>
                <option value="reference">Reference</option>
                <option value="guides">Guides</option>
              </select>
            </div>
            {createMode === "article" ? (
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write markdown content..."
                rows={8}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay-subtle)] px-3 py-2 font-mono text-sm text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
              />
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-[var(--radius-md)] border border-dashed px-4 py-6 text-center transition ${
                  isDragging
                    ? "border-amber-400/60 bg-amber-400/8"
                    : "border-[var(--color-border)] bg-white/3 hover:border-[var(--color-border-bright)] hover:bg-white/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <Upload size={20} className={`mx-auto mb-2 ${isDragging ? "text-amber-400" : "text-[var(--color-text-tertiary)]"}`} />
                {newFile ? (
                  <span className="text-sm text-amber-200">{newFile.name} ({formatFileSize(newFile.size)})</span>
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {isDragging ? "Drop file here" : "Drag and drop or click to select file"}
                    <br />
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">PDF, DOCX, TXT, MD, PNG, JPG - max 10MB</span>
                  </span>
                )}
              </div>
            )}
            {uploadError ? (
              <p className="text-xs text-red-400">{uploadError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateForm(false); setUploadError(null); setNewFile(null); }}
                className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !newTitle.trim() || (createMode === "article" ? !newBody.trim() : !newFile)}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-400/20 bg-amber-400/8 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
              >
                {isPending ? <LoaderCircle size={12} className="animate-spin" /> : null}
                {createMode === "article" ? "Publish" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Entries list */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          const hasInlineContent = item.body && item.body.length > 0;
          const bodyIsHtml = hasInlineContent && isHtmlContent(item.body);

          return (
            <div
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/3"
              >
                {isExpanded ? <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--color-text-tertiary)]" />}
                {item.entryType === "file" && !hasInlineContent ? (
                  <Download size={14} className="flex-shrink-0 text-cyan-300" />
                ) : (
                  <FileText size={14} className="flex-shrink-0 text-[var(--color-accent)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {item.authorDisplay} / {formatDate(item.updatedAt)}
                    {item.fileName ? ` / ${item.fileName} (${formatFileSize(item.fileSize ?? 0)})` : ""}
                  </p>
                </div>
                <span className={`flex-shrink-0 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${categoryBadge[item.category] ?? categoryBadge.general}`}>
                  {categoryLabel[item.category] ?? item.category}
                </span>
              </button>

              {isExpanded ? (
                <div className="border-t border-[var(--color-border)] px-5 py-4">
                  {/* Inline content: article text or extracted file content */}
                  {hasInlineContent ? (
                    bodyIsHtml ? (
                      <div
                        className="manual-doc-content max-w-none text-sm leading-7 text-slate-300"
                        dangerouslySetInnerHTML={{ __html: item.body }}
                      />
                    ) : (
                      <div className="max-w-none text-sm leading-7 text-slate-300 whitespace-pre-wrap">
                        {item.body}
                      </div>
                    )
                  ) : null}

                  {/* Download button for file entries */}
                  {item.entryType === "file" ? (
                    <div className={`flex items-center gap-3 ${hasInlineContent ? "mt-4 border-t border-[var(--color-border)] pt-3" : ""}`}>
                      <a
                        href={`/api/manual/${item.id}/download`}
                        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15"
                      >
                        <Download size={13} />
                        Download {item.fileName}
                      </a>
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        {formatFileSize(item.fileSize ?? 0)} / {item.fileMimeType}
                      </span>
                    </div>
                  ) : null}

                  {/* No content available */}
                  {item.entryType === "file" && !hasInlineContent ? (
                    <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
                      Inline preview not available for this file type. Use the download button above.
                    </p>
                  ) : null}

                  {canAuthor ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[10px] text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
            No manual entries yet.{canAuthor ? " Create one above." : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
