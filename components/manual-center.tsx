"use client";

import { useState, useTransition } from "react";
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

type CategoryFilter = "all" | "general" | "sop" | "procedures" | "training" | "reference" | "guides";

export function ManualCenter({ initialItems, canAuthor }: ManualCenterProps) {
  const [items, setItems] = useState<ManualItem[]>(initialItems);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createMode, setCreateMode] = useState<"article" | "file">("article");
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newBody, setNewBody] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);

  const filtered = categoryFilter === "all"
    ? items
    : items.filter((i) => i.category === categoryFilter);

  function handleCreate() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
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
        if (res.ok) {
          // Refresh list
          const listRes = await fetch("/api/manual");
          const data = await listRes.json();
          if (data.ok) setItems(data.items);
          setNewTitle("");
          setNewBody("");
          setShowCreateForm(false);
        }
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
        if (res.ok) {
          const listRes = await fetch("/api/manual");
          const data = await listRes.json();
          if (data.ok) setItems(data.items);
          setNewTitle("");
          setNewFile(null);
          setShowCreateForm(false);
        }
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
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <BookOpen size={14} className="text-amber-300" />
            <span>{filtered.length} entries</span>
          </div>
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-slate-500" />
            {(["all", "sop", "procedures", "training", "reference", "guides", "general"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  categoryFilter === f
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
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
            <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.1em] text-white">New Entry</p>
            <div className="flex gap-1">
              <button
                onClick={() => setCreateMode("article")}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  createMode === "article" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <FileText size={11} className="mr-1 inline" />
                Article
              </button>
              <button
                onClick={() => setCreateMode("file")}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  createMode === "file" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
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
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/40 focus:outline-none"
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
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
              />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-white/3 px-4 py-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="manual-file-input"
                />
                <label
                  htmlFor="manual-file-input"
                  className="cursor-pointer text-sm text-slate-400 transition hover:text-white"
                >
                  <Upload size={20} className="mx-auto mb-2 text-slate-500" />
                  {newFile ? (
                    <span className="text-amber-200">{newFile.name} ({formatFileSize(newFile.size)})</span>
                  ) : (
                    <span>Click to select file (PDF, DOCX, TXT, MD, PNG, JPG - max 10MB)</span>
                  )}
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
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
          return (
            <div
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border-bright)] bg-[var(--color-panel)] panel-elevated"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/3"
              >
                {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                {item.entryType === "file" ? (
                  <Download size={14} className="flex-shrink-0 text-cyan-300" />
                ) : (
                  <FileText size={14} className="flex-shrink-0 text-amber-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
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
                  {item.entryType === "article" && item.body ? (
                    <div className="prose-invert max-w-none text-sm leading-7 text-slate-300 whitespace-pre-wrap">
                      {item.body}
                    </div>
                  ) : null}
                  {item.entryType === "file" ? (
                    <div className="flex items-center gap-3">
                      <a
                        href={`/api/manual/${item.id}/download`}
                        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-cyan-400/20 bg-cyan-400/8 px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-400/15"
                      >
                        <Download size={13} />
                        Download {item.fileName}
                      </a>
                      <span className="text-[10px] text-slate-500">
                        {formatFileSize(item.fileSize ?? 0)} / {item.fileMimeType}
                      </span>
                    </div>
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
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/3 px-4 py-8 text-center text-sm text-slate-500">
            No manual entries yet.{canAuthor ? " Create one above." : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
