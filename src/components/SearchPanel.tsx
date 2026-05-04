import {
  AlertTriangle,
  Clock3,
  Clipboard,
  Copy,
  Code2,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  LayoutList,
  Link,
  Pin,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { filterClips, moveSelection } from "../domain/clipSearch";
import { playCopySound } from "../domain/copySound";
import { createMotionSettings } from "../domain/motion";
import { matchesShortcut } from "../domain/shortcuts";
import type { ClipFilter, ClipItem, OptionalClipFilter, Settings } from "../domain/types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  ClipRow,
  EmptyState,
  Feedback,
  IconButton,
  LoadingState,
  SearchStrip
} from "./SearchPanelParts";

type FilterDefinition<T extends ClipFilter = ClipFilter> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type ClipAction = (id: string) => void | Promise<void>;
type PanelAction = () => void | Promise<void>;
type DestructiveConfirmation = {
  message: string;
  resolve: (value: boolean) => void;
};

interface SearchPanelProps {
  clips: ClipItem[];
  settings: Settings;
  busyLabel?: string | null;
  error?: string | null;
  focusSignal?: number;
  loading?: boolean;
  runtimeLabel?: string;
  onClearHistory?: PanelAction;
  onCopyClip: ClipAction;
  onDeleteClip: ClipAction;
  onPermanentlyDeleteClip?: ClipAction;
  onHidePanel?: PanelAction;
  onOpenSettings?: PanelAction;
  onPasteClip: ClipAction;
  onRefresh?: PanelAction;
  onRestoreClip?: ClipAction;
  onStartWindowDrag?: PanelAction;
  onToggleFavorite?: ClipAction;
  onTogglePanelPinned?: PanelAction;
  onUpdateClipText?: (id: string, text: string) => void | Promise<void>;
}

const primaryFilters: Array<FilterDefinition> = [
  { id: "all", label: "全部", icon: LayoutList },
  { id: "text", label: "文本", icon: FileText },
  { id: "favorite", label: "收藏", icon: Star },
  { id: "image", label: "图片", icon: ImageIcon },
  { id: "file", label: "文件", icon: FileIcon }
];

const optionalFilters: Array<FilterDefinition<OptionalClipFilter>> = [
  { id: "link", label: "链接", icon: Link },
  { id: "code", label: "代码", icon: Code2 },
  { id: "richText", label: "富文本", icon: FileText },
  { id: "recent", label: "最近使用", icon: Clock3 }
];

export function SearchPanel({
  clips,
  settings,
  error = null,
  focusSignal = 0,
  loading = false,
  onClearHistory,
  onCopyClip,
  onDeleteClip,
  onPermanentlyDeleteClip,
  onHidePanel,
  onOpenSettings,
  onPasteClip,
  onRefresh,
  onRestoreClip,
  onStartWindowDrag,
  onToggleFavorite = noopClipAction,
  onTogglePanelPinned,
  onUpdateClipText
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClipFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "copied" | "pasted" | "moved" | "restored" | "deleted">("idle");
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [confirmation, setConfirmation] = useState<DestructiveConfirmation | null>(null);
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const motionSettings = useMemo(() => createMotionSettings(settings.motionPreset), [settings.motionPreset]);
  const layerInitial = prefersReducedMotion ? false : motionSettings.clipboardLayerMotion.initial;
  const layerAnimate = prefersReducedMotion ? undefined : motionSettings.clipboardLayerMotion.animate;

  const visibleFilters = useMemo(() => {
    const enabledOptionalFilters = new Set(settings.optionalFilters ?? []);
    return [
      ...primaryFilters,
      ...optionalFilters.filter((item) => enabledOptionalFilters.has(item.id))
    ];
  }, [settings.optionalFilters]);

  const visibleClips = useMemo(
    () => filterClips(clips, { query: deferredQuery, filter }),
    [clips, deferredQuery, filter]
  );
  const activeClips = useMemo(() => clips.filter((clip) => !clip.deletedAt), [clips]);
  const displayedClips = visibleClips;
  const selectedClip = displayedClips[selectedIndex] ?? null;
  const editingClip = clips.find((clip) => clip.id === editingClipId) ?? null;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [deferredQuery, filter]);

  useEffect(() => {
    if (!visibleFilters.some((item) => item.id === filter)) {
      setFilter("all");
    }
  }, [filter, visibleFilters]);

  useEffect(() => {
    if (selectedIndex >= displayedClips.length) {
      setSelectedIndex(Math.max(0, displayedClips.length - 1));
    }
  }, [displayedClips.length, selectedIndex]);

  useEffect(() => {
    if (editingClipId && !visibleClips.some((clip) => clip.id === editingClipId)) {
      setEditingClipId(null);
      setDraftText("");
    }
  }, [editingClipId, visibleClips]);

  useEffect(() => {
    if (editingClip) {
      setDraftText(editingClip.text);
    }
  }, [editingClip]);

  function handleKeyDown(event: KeyboardEvent) {
    if (editingClipId) {
      return;
    }

    if (matchesShortcut(event, settings.shortcuts.nextItem)) {
      event.preventDefault();
      setSelectedIndex((index) => moveSelection(index, 1, displayedClips.length));
      return;
    }

    if (matchesShortcut(event, settings.shortcuts.previousItem)) {
      event.preventDefault();
      setSelectedIndex((index) => moveSelection(index, -1, displayedClips.length));
      return;
    }

    if (event.key === "Escape" && onHidePanel) {
      event.preventDefault();
      void onHidePanel();
      return;
    }

    if (selectedClip?.deletedAt) {
      if (selectedClip && matchesShortcut(event, settings.shortcuts.deleteSelected)) {
        event.preventDefault();
        void runClipAction(
          onPermanentlyDeleteClip ?? onDeleteClip,
          selectedClip.id,
          "deleted",
          "确定彻底删除这条回收站内容吗？"
        );
      }

      return;
    }

    if (selectedClip && matchesShortcut(event, settings.shortcuts.copySelected)) {
      event.preventDefault();
      void runClipAction(onCopyClip, selectedClip.id, "copied");
      return;
    }

    if (selectedClip && matchesShortcut(event, settings.shortcuts.pasteSelected)) {
      event.preventDefault();
      void runClipAction(onPasteClip, selectedClip.id, "pasted");
      return;
    }

    if (selectedClip && matchesShortcut(event, settings.shortcuts.deleteSelected)) {
      event.preventDefault();
      void runClipAction(
        onDeleteClip,
        selectedClip.id,
        "moved",
        "删除这条剪切板内容后会进入回收站，继续吗？"
      );
    }
  }

  async function runClipAction(
    action: ClipAction,
    id: string,
    nextFeedback: "copied" | "pasted" | "moved" | "restored" | "deleted",
    confirmMessage?: string
  ) {
    if (confirmMessage && !(await requestDestructiveConfirmation(confirmMessage))) {
      return;
    }

    await action(id);
    if (nextFeedback === "copied" && settings.copySound) {
      playCopySound();
    }
    pulseFeedback(nextFeedback);
  }

  async function handleClearHistory() {
    if (!(await requestDestructiveConfirmation("清空全部剪切板历史？"))) {
      return;
    }

    await onClearHistory?.();
  }

  function requestDestructiveConfirmation(message: string): Promise<boolean> {
    if (!settings.deleteConfirmation) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      setConfirmation({ message, resolve });
    });
  }

  function settleDestructiveConfirmation(value: boolean) {
    setConfirmation((current) => {
      current?.resolve(value);
      return null;
    });
  }

  function pulseFeedback(nextFeedback: "copied" | "pasted" | "moved" | "restored" | "deleted") {
    setFeedback(nextFeedback);
    window.setTimeout(() => setFeedback("idle"), 1200);
  }

  function openSettingsPage() {
    window.location.assign("/settings");
  }

  function startEditing(clip: ClipItem) {
    if (!canEditClip(clip) || !onUpdateClipText) {
      return;
    }

    setEditingClipId(clip.id);
    setDraftText(clip.text);
  }

  function cancelEditing() {
    setEditingClipId(null);
    setDraftText("");
  }

  function saveEditing() {
    if (!editingClipId || !onUpdateClipText) {
      return;
    }

    const nextText = draftText.trim();
    if (!nextText) {
      return;
    }

    void onUpdateClipText(editingClipId, nextText);
    cancelEditing();
  }

  function openLink(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        window.open(parsed.toString(), "_blank", "noopener,noreferrer");
      }
    } catch {
      // 忽略非法链接。
    }
  }

  function handleWindowDragPointerDown(event: PointerEvent<HTMLElement>) {
    if (!onStartWindowDrag || event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("button, input, textarea, a, [data-no-window-drag='true']")) {
      return;
    }

    void onStartWindowDrag();
  }

  return (
    <motion.section
      className="clip-shell"
      data-search-position={settings.searchBoxPosition}
      data-pinned={settings.panelPinned ? "true" : undefined}
      data-edge-auto-hide={settings.edgeAutoHide ? "true" : undefined}
      data-motion-preset={settings.motionPreset}
      aria-label="ClipFlow 剪切板搜索面板"
      initial={prefersReducedMotion ? false : motionSettings.clipboardPanelMotion.initial}
      animate={prefersReducedMotion ? undefined : motionSettings.clipboardPanelMotion.animate}
      transition={motionSettings.clipboardPanelMotion.transition}
      onKeyDown={handleKeyDown}
    >
      <motion.header
        className="panel-header"
        initial={layerInitial}
        animate={layerAnimate}
        transition={motionSettings.clipboardLayerTransition(motionSettings.clipboardLayerDelays.header)}
        onPointerDown={handleWindowDragPointerDown}
      >
        <div className="brand-lockup">
          <motion.span
            className="brand-mark"
            aria-hidden="true"
          >
            <Clipboard size={18} />
          </motion.span>
          <div>
            <h1>ClipFlow</h1>
          </div>
        </div>

        <div className="panel-actions">
          <IconButton label="刷新历史" motionPreset={settings.motionPreset} onClick={onRefresh}>
            <RefreshCw size={17} />
          </IconButton>
          <IconButton danger disabled={activeClips.length === 0 || !onClearHistory} label="清空历史" motionPreset={settings.motionPreset} onClick={handleClearHistory}>
            <Trash2 size={17} />
          </IconButton>
          <IconButton active={Boolean(settings.panelPinned)} label={settings.panelPinned ? "取消固定" : "固定在最上层"} motionPreset={settings.motionPreset} onClick={onTogglePanelPinned}>
            <Pin size={17} />
          </IconButton>
          <IconButton label="设置" motionPreset={settings.motionPreset} onClick={onOpenSettings ?? openSettingsPage}>
            <SlidersHorizontal size={17} />
          </IconButton>
          <IconButton label="隐藏面板" motionPreset={settings.motionPreset} onClick={onHidePanel}>
            <X size={17} />
          </IconButton>
        </div>
      </motion.header>

      {settings.searchBoxPosition === "top" ? renderSearchStrip() : null}

      {error ? (
        <div className="error-banner" role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <motion.div
        className="filter-row"
        role="tablist"
        aria-label="剪切板分类"
        initial={layerInitial}
        animate={layerAnimate}
        transition={motionSettings.clipboardLayerTransition(motionSettings.clipboardLayerDelays.filter)}
      >
        {visibleFilters.map((item) => {
          const FilterIcon = item.icon;
          return (
            <motion.button
              key={item.id}
              className={item.id === filter ? "filter-chip active" : "filter-chip"}
              type="button"
              role="tab"
              aria-selected={item.id === filter}
              layout
              transition={motionSettings.settingsSectionTransition}
              onClick={() => setFilter(item.id)}
            >
              <FilterIcon aria-hidden="true" size={14} strokeWidth={2.35} />
              {item.label}
            </motion.button>
          );
        })}
      </motion.div>

      <motion.div
        className="clip-list-frame"
        initial={layerInitial}
        animate={layerAnimate}
        transition={motionSettings.clipboardLayerTransition(motionSettings.clipboardLayerDelays.list)}
      >
        <div className="clip-list" role="listbox" aria-busy={loading} aria-label="剪切板历史">
          {loading && displayedClips.length === 0 ? (
            <LoadingState />
          ) : displayedClips.length === 0 ? (
            <EmptyState filter={filter} query={query} />
          ) : (
            <AnimatePresence initial={!prefersReducedMotion} mode="popLayout">
              {displayedClips.map((clip, index) => (
                <ClipRow
                  key={clip.id}
                  clip={clip}
                  draftText={draftText}
                  entryBaseDelay={motionSettings.clipboardLayerDelays.rows}
                  editing={editingClipId === clip.id}
                  index={index}
                  motionEnabled={!prefersReducedMotion}
                  motionPreset={settings.motionPreset}
                  query={query}
                  onCancelEdit={cancelEditing}
                  onDraftTextChange={setDraftText}
                  onEditStart={startEditing}
                  selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onSelect={() => setSelectedIndex(index)}
                  onOpenLink={openLink}
                  pasteTrigger={settings.mousePasteTrigger}
                  onPasteClip={(id) => runClipAction(onPasteClip, id, "pasted")}
                  onPermanentlyDeleteClip={
                    onPermanentlyDeleteClip
                      ? (id) =>
                          runClipAction(
                            onPermanentlyDeleteClip,
                            id,
                            "deleted",
                            "确定彻底删除这条回收站内容吗？"
                          )
                      : undefined
                  }
                  onRestoreClip={
                    onRestoreClip
                      ? (id) => runClipAction(onRestoreClip, id, "restored")
                      : undefined
                  }
                  onSaveEdit={saveEditing}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {settings.searchBoxPosition === "bottom" ? renderSearchStrip() : null}

      <motion.footer
        className="panel-footer"
        initial={layerInitial}
        animate={layerAnimate}
        transition={motionSettings.clipboardLayerTransition(motionSettings.clipboardLayerDelays.footer)}
      >
        <span>{visibleClips.length} 项匹配</span>
        <div className="footer-actions">
          {selectedClip ? (
            selectedClip.deletedAt ? (
              <>
                <IconButton
                  label="恢复剪切板"
                  disabled={!onRestoreClip}
                  motionPreset={settings.motionPreset}
                  onClick={() =>
                    runClipAction(
                      onRestoreClip ?? onDeleteClip,
                      selectedClip.id,
                      "restored"
                    )
                  }
                >
                  <RotateCcw size={16} />
                </IconButton>
                <IconButton
                  danger
                  label="彻底删除"
                  disabled={!onPermanentlyDeleteClip}
                  motionPreset={settings.motionPreset}
                  onClick={() =>
                    runClipAction(
                      onPermanentlyDeleteClip ?? onDeleteClip,
                      selectedClip.id,
                      "deleted",
                      "确定彻底删除这条回收站内容吗？"
                    )
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton
                  label="复制选中项"
                  motionPreset={settings.motionPreset}
                  onClick={() => runClipAction(onCopyClip, selectedClip.id, "copied")}
                >
                  <Copy size={16} />
                </IconButton>
                <IconButton
                  danger
                  label="移入回收站"
                  motionPreset={settings.motionPreset}
                  onClick={() =>
                    runClipAction(
                      onDeleteClip,
                      selectedClip.id,
                      "moved",
                      "删除这条剪切板内容后会进入回收站，继续吗？"
                    )
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              </>
            )
          ) : null}
          <Feedback feedback={feedback} motionPreset={settings.motionPreset} />
        </div>
      </motion.footer>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title="删除剪切板内容"
        description={confirmation?.message ?? ""}
        confirmLabel="删除"
        motionPreset={settings.motionPreset}
        onCancel={() => settleDestructiveConfirmation(false)}
        onConfirm={() => settleDestructiveConfirmation(true)}
      />
    </motion.section>
  );

  function renderSearchStrip() {
    return (
      <SearchStrip
        entryDelay={motionSettings.clipboardLayerDelays.search}
        inputRef={searchInputRef}
        loading={loading}
        motionPreset={settings.motionPreset}
        query={query}
        onQueryChange={setQuery}
      />
    );
  }
}

function noopClipAction() {
  return undefined;
}

function canEditClip(clip: ClipItem): boolean {
  return clip.kind !== "image" && clip.kind !== "file" && !clip.deletedAt;
}
