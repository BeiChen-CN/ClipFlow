import {
  Check,
  Clipboard,
  Code2,
  Copy,
  FileText,
  File as FileIcon,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  Search,
  Star,
  PencilLine,
  RotateCcw,
  Trash2
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { RefObject } from "react";
import type { ReactNode } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { extractUrls } from "../domain/clipSearch";
import { clipRowTransition, md3Ease } from "../domain/motion";
import type { ClipFilter, ClipItem, MousePasteTrigger, Settings } from "../domain/types";

type PanelAction = () => void | Promise<void>;

export function SearchStrip({
  busyLabel,
  clips,
  inputRef,
  loading,
  onQueryChange,
  query,
  settings
}: {
  busyLabel: string | null;
  clips: ClipItem[];
  inputRef: RefObject<HTMLInputElement>;
  loading: boolean;
  onQueryChange: (value: string) => void;
  query: string;
  settings: Settings;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="search-strip"
      data-search-active={query.trim() ? "true" : undefined}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: md3Ease }}
    >
      <Search aria-hidden="true" className="search-icon" />
      <input
        ref={inputRef}
        aria-label="搜索剪切板历史"
        className="search-input"
        id="clip-search"
        name="clip-search"
        placeholder="搜索历史、图片、文件、链接或代码片段"
        role="searchbox"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <StatusChip busyLabel={busyLabel} clips={clips} loading={loading} settings={settings} />
    </motion.div>
  );
}

export function StatusChip({
  busyLabel,
  clips,
  loading,
  settings
}: {
  busyLabel: string | null;
  clips: ClipItem[];
  loading: boolean;
  settings: Settings;
}) {
  if (loading || busyLabel) {
    return (
      <span className="status-chip">
        <Loader2 aria-hidden="true" className="spin" size={15} />
        {busyLabel ?? "同步中"}
      </span>
    );
  }

  return (
    <span className="status-chip">
      <Clipboard aria-hidden="true" size={15} />
      {formatHistoryCount(clips.length, settings.historyLimit)}
    </span>
  );
}

function formatHistoryCount(count: number, limit: number): string {
  return limit === 0 ? `${count}/无限` : `${count}/${limit}`;
}

export function ClipRow({
  clip,
  draftText,
  editing,
  index,
  motionEnabled,
  onCancelEdit,
  onDraftTextChange,
  onEditStart,
  onMouseEnter,
  onOpenLink,
  onPasteClip,
  onPermanentlyDeleteClip,
  onRestoreClip,
  onSaveEdit,
  onSelect,
  onToggleFavorite,
  pasteTrigger,
  query,
  selected
}: {
  clip: ClipItem;
  draftText: string;
  editing: boolean;
  index: number;
  motionEnabled: boolean;
  onCancelEdit: () => void;
  onDraftTextChange: (value: string) => void;
  onEditStart: (clip: ClipItem) => void;
  onMouseEnter: () => void;
  onOpenLink: (url: string) => void;
  onPasteClip: (id: string) => void | Promise<void>;
  onPermanentlyDeleteClip?: (id: string) => void | Promise<void>;
  onRestoreClip?: (id: string) => void | Promise<void>;
  onSaveEdit: () => void | Promise<void>;
  onSelect: () => void;
  onToggleFavorite: (id: string) => void | Promise<void>;
  pasteTrigger: MousePasteTrigger;
  query: string;
  selected: boolean;
}) {
  const isEditable = isEditableClip(clip);
  const isEditing = editing && isEditable;

  function handleSelect() {
    onSelect();
    if (clip.deletedAt || isEditing) {
      return;
    }

    if (pasteTrigger === "singleClick") {
      void onPasteClip(clip.id);
    }
  }

  function handleDoubleClick() {
    if (clip.deletedAt || isEditing) {
      return;
    }

    if (pasteTrigger === "doubleClick") {
      void onPasteClip(clip.id);
    }
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancelEdit();
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void onSaveEdit();
    }
  }

  return (
    <motion.div
      className={createClipRowClass(selected, isEditing, Boolean(clip.deletedAt))}
      role="option"
      aria-selected={selected}
      aria-label={createClipRowLabel(clip, index, selected)}
      tabIndex={-1}
      layout={motionEnabled}
      initial={motionEnabled ? { opacity: 0, y: 8, scale: 0.985 } : false}
      animate={motionEnabled ? { opacity: 1, y: 0, scale: selected ? 1.006 : 1 } : undefined}
      exit={motionEnabled ? { opacity: 0, y: -6, scale: 0.98 } : undefined}
      transition={clipRowTransition(index)}
      whileHover={motionEnabled ? { y: -1 } : undefined}
      onMouseEnter={onMouseEnter}
      onClick={handleSelect}
      onDoubleClick={handleDoubleClick}
    >
      <span className={createClipKeyClass(clip.kind)}>
        {selected ? "↵" : <ClipKey kind={clip.kind} index={index} />}
      </span>

      <span className="clip-copy">
        {isEditing ? (
          <span className="clip-editor">
            <textarea
              autoFocus
              className="clip-editor-input"
              value={draftText}
              onChange={(event) => onDraftTextChange(event.currentTarget.value)}
              onKeyDown={handleEditorKeyDown}
            />
            <span className="clip-editor-actions">
              <button type="button" onClick={() => void onSaveEdit()}>
                保存
              </button>
              <button type="button" onClick={onCancelEdit}>
                取消
              </button>
            </span>
          </span>
        ) : (
          <>
            <span className="clip-text">
              {renderHighlightedText(clip.preview, query, onOpenLink)}
            </span>
            <span className="clip-meta">
              {clip.sourceAppIcon ? (
                <img alt="" className="clip-source-icon" src={clip.sourceAppIcon} />
              ) : clip.sourceAppName ? (
                <span className="clip-source-fallback" aria-hidden="true">
                  {clip.sourceAppName.slice(0, 1).toUpperCase()}
                </span>
              ) : null}
              {clip.sourceAppName ? <span>{clip.sourceAppName}</span> : null}
              <KindIcon kind={clip.kind} />
              <span>{kindLabel(clip.kind)}</span>
              {kindDetail(clip) ? <span>{kindDetail(clip)}</span> : null}
              {clip.deletedAt ? <span>回收站 · {relativeTime(clip.deletedAt)}</span> : <span>{relativeTime(clip.createdAt)}</span>}
            </span>
          </>
        )}
      </span>

      <span className="clip-actions-inline">
        {clip.deletedAt ? (
          <>
            <button
              className="clip-favorite-button active"
              type="button"
              disabled={!onRestoreClip}
              aria-label="恢复剪切板"
              title="恢复剪切板"
              onClick={(event) => {
                event.stopPropagation();
                void onRestoreClip?.(clip.id);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <RotateCcw aria-hidden="true" size={15} />
            </button>
            <button
              className="clip-favorite-button"
              type="button"
              disabled={!onPermanentlyDeleteClip}
              aria-label="彻底删除"
              title="彻底删除"
              onClick={(event) => {
                event.stopPropagation();
                void onPermanentlyDeleteClip?.(clip.id);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </>
        ) : (
          <>
            {isEditable ? (
              <button
                className="clip-action-button"
                type="button"
                aria-label="编辑内容"
                title="编辑内容"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditStart(clip);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <PencilLine aria-hidden="true" size={15} />
              </button>
            ) : null}
            <button
              className={clip.isFavorite ? "clip-favorite-button active" : "clip-favorite-button"}
              type="button"
              aria-label={clip.isFavorite ? "取消收藏" : "收藏"}
              aria-pressed={Boolean(clip.isFavorite)}
              title={clip.isFavorite ? "取消收藏" : "收藏"}
              onClick={(event) => {
                event.stopPropagation();
                void onToggleFavorite(clip.id);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <Star aria-hidden="true" size={15} fill={clip.isFavorite ? "currentColor" : "none"} />
            </button>
            <span className="clip-time">{clip.useCount > 0 ? `${clip.useCount}次` : "新"}</span>
          </>
        )}
      </span>
    </motion.div>
  );
}

function renderHighlightedText(value: string, query: string, onOpenLink: (url: string) => void): ReactNode[] {
  const urls = extractUrls(value);
  if (urls.length === 0) {
    return renderTextSegments(value, query);
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const url of urls) {
    const start = value.indexOf(url, cursor);
    if (start < 0) {
      continue;
    }

    if (start > cursor) {
      nodes.push(...renderTextSegments(value.slice(cursor, start), query));
    }

    nodes.push(
      <button
        key={`${url}-${start}`}
        aria-label={`打开链接 ${url}`}
        className="clip-inline-link"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenLink(url);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {renderTextSegments(url, query)}
        <ExternalLink aria-hidden="true" size={12} />
      </button>
    );
    cursor = start + url.length;
  }

  if (cursor < value.length) {
    nodes.push(...renderTextSegments(value.slice(cursor), query));
  }

  return nodes.length > 0 ? nodes : renderTextSegments(value, query);
}

function renderTextSegments(value: string, query: string): ReactNode[] {
  const terms = normalizeQueryTerms(query);
  if (terms.length === 0) {
    return [value];
  }

  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  return value.split(regex).map((segment, index) =>
    index % 2 === 1 ? (
      <mark key={`${segment}-${index}`} className="clip-highlight">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    )
  );
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function LoadingState() {
  return (
    <div className="empty-state">
      <Loader2 aria-hidden="true" className="spin" size={28} />
      <strong>正在同步历史</strong>
      <span>读取本地数据库。</span>
    </div>
  );
}

export function EmptyState({ filter, query }: { filter: ClipFilter; query: string }) {
  const emptyCopy = filter === "trash"
    ? { title: "回收站为空", detail: "删除后的内容会先保存在这里。" }
    : { title: "还没有剪切板历史", detail: "复制文本、图片或文件后会自动记录。" };

  return (
    <div className="empty-state">
      <Search aria-hidden="true" size={28} />
      <strong>{query ? "没有匹配结果" : emptyCopy.title}</strong>
      <span>{query ? "换个关键词试试。" : emptyCopy.detail}</span>
    </div>
  );
}

export function Feedback({
  busyLabel,
  feedback
}: {
  busyLabel: string | null;
  feedback: "idle" | "copied" | "pasted" | "moved" | "restored" | "deleted";
}) {
  if (busyLabel) {
    return (
      <span className="footer-pill active">
        <Loader2 aria-hidden="true" className="spin" size={15} />
        {busyLabel}
      </span>
    );
  }

  if (feedback === "idle") {
    return <span className="footer-pill">就绪</span>;
  }

  const labels = {
    copied: "已复制",
    pasted: "已粘贴",
    moved: "已移入回收站",
    restored: "已恢复",
    deleted: "已删除"
  } as const;
  const Icon =
    feedback === "restored"
      ? RotateCcw
      : feedback === "deleted" || feedback === "moved"
        ? Trash2
        : feedback === "copied"
          ? Copy
          : Check;

  return (
    <span className="footer-pill active">
      <Icon aria-hidden="true" size={15} />
      {labels[feedback]}
    </span>
  );
}

export function IconButton({
  active = false,
  children,
  danger = false,
  disabled = false,
  label,
  onClick
}: {
  active?: boolean;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: PanelAction;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      aria-label={label}
      className={createIconButtonClass(danger, active)}
      disabled={disabled || !onClick}
      title={label}
      type="button"
      whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
      onClick={() => void onClick?.()}
    >
      {children}
    </motion.button>
  );
}

function createIconButtonClass(danger: boolean, active: boolean): string {
  const classes = ["icon-button"];
  if (danger) {
    classes.push("danger");
  }
  if (active) {
    classes.push("active");
  }

  return classes.join(" ");
}

function KindIcon({ kind }: { kind: ClipItem["kind"] }) {
  if (kind === "image") {
    return <ImageIcon aria-hidden="true" size={14} />;
  }

  if (kind === "file") {
    return <FileIcon aria-hidden="true" size={14} />;
  }

  if (kind === "link") {
    return <Link2 aria-hidden="true" size={14} />;
  }

  if (kind === "code") {
    return <Code2 aria-hidden="true" size={14} />;
  }

  if (kind === "richText") {
    return <FileText aria-hidden="true" size={14} />;
  }

  return <Clipboard aria-hidden="true" size={14} />;
}

function ClipKey({ index, kind }: { index: number; kind: ClipItem["kind"] }) {
  if (kind === "image") {
    return <ImageIcon aria-hidden="true" size={16} />;
  }

  if (kind === "file") {
    return <FileIcon aria-hidden="true" size={16} />;
  }

  if (kind === "richText") {
    return <FileText aria-hidden="true" size={16} />;
  }

  return <>{index + 1}</>;
}

function createClipKeyClass(kind: ClipItem["kind"]): string {
  return kind === "image" || kind === "file" || kind === "richText" ? `clip-key ${kind}` : "clip-key";
}

function createClipRowClass(selected: boolean, editing: boolean, trashed: boolean): string {
  const classes = ["clip-row"];
  if (selected) {
    classes.push("active");
  }
  if (editing) {
    classes.push("editing");
  }
  if (trashed) {
    classes.push("trashed");
  }
  return classes.join(" ");
}

function createClipRowLabel(clip: ClipItem, index: number, selected: boolean): string {
  const key = selected ? "↵" : String(index + 1);
  const detail = kindDetail(clip);
  const metadata = detail ? `${kindLabel(clip.kind)} · ${detail}` : kindLabel(clip.kind);
  const usage = clip.useCount > 0 ? `${clip.useCount}次` : "新";
  const source = clip.sourceAppName ? ` · 来源 ${clip.sourceAppName}` : "";
  const state = clip.deletedAt ? ` · 回收站 ${relativeTime(clip.deletedAt)}` : "";
  return `${key} ${clip.preview} ${metadata}${source}${state} · ${relativeTime(clip.createdAt)} ${usage}`;
}

function kindLabel(kind: ClipItem["kind"]): string {
  if (kind === "link") {
    return "链接";
  }

  if (kind === "code") {
    return "代码";
  }

  if (kind === "image") {
    return "图片";
  }

  if (kind === "file") {
    return "文件";
  }

  if (kind === "richText") {
    return "富文本";
  }

  return "文本";
}

function kindDetail(clip: ClipItem): string {
  if (clip.kind === "image" && clip.imageWidth && clip.imageHeight) {
    return `${clip.imageWidth}×${clip.imageHeight}`;
  }

  if (clip.kind === "file" && clip.fileCount) {
    return `${clip.fileCount} 个文件`;
  }

  return "";
}

function isEditableClip(clip: ClipItem): boolean {
  return clip.kind !== "image" && clip.kind !== "file" && !clip.deletedAt;
}

function relativeTime(value: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${Math.floor(diffHours / 24)} 天前`;
}
