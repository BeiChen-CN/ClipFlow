import { classifyClip, createClipPreview, normalizeClipText } from "./domain/clipSearch";
import type { ClipItem, Settings } from "./domain/types";

export const defaultSettings: Settings = {
  hotkey: "Alt+C",
  shortcuts: {
    showPanel: "Alt+C",
    pasteSelected: "Enter",
    copySelected: "Ctrl+Enter",
    deleteSelected: "Delete",
    nextItem: "ArrowDown",
    previousItem: "ArrowUp"
  },
  historyLimit: 100,
  retentionDays: 30,
  trashRetentionDays: 7,
  launchOnStartup: false,
  showTrayIcon: true,
  showTaskbarIcon: true,
  colorPreset: "teal",
  customColor: "#0d9488",
  motionPreset: "a",
  autoSortDuplicates: false,
  minimizeOnClose: true,
  panelPinned: false,
  windowPosition: "remember",
  copySound: false,
  searchBoxPosition: "top",
  mousePasteTrigger: "doubleClick",
  deleteConfirmation: true,
  edgeAutoHide: false,
  optionalFilters: [],
  capturePaused: false,
  themeMode: "system"
};

const seedTexts = [
  "Material 3 Expressive token plan",
  "cargo tauri dev --target x86_64-pc-windows-msvc",
  "https://m3.material.io/blog/building-with-m3-expressive",
  "参考链接在这里 https://tauri.app/start 和 https://react.dev/reference/react",
  "SendInput 粘贴适配层测试计划",
  "Plus Jakarta Sans packaged locally"
];

export function createDemoClips(now = Date.now()): ClipItem[] {
  return [
    createImageSeed(now),
    createFileSeed(now),
    createRichTextSeed(now),
    createTrashSeed(now),
    ...seedTexts.map((text, index) => createSeedClip(text, index + 2, now))
  ];
}

function createSeedClip(text: string, index: number, now: number): ClipItem {
  const normalized = normalizeClipText(text);
  const createdAt = new Date(now - index * 180_000).toISOString();

  return {
    id: String(index + 1),
    text: normalized,
    preview: createClipPreview(normalized),
    kind: classifyClip(normalized),
    contentHash: `seed-${index}`,
    createdAt,
    lastUsedAt: index === 0 ? createdAt : null,
    useCount: index === 0 ? 3 : 0,
    sourceAppName: index % 2 === 0 ? "Chrome" : "Code",
    sourceAppIcon: null,
    sourceAppPath: null
  };
}

function createImageSeed(now: number): ClipItem {
  const createdAt = new Date(now).toISOString();
  return {
    id: "image-1",
    text: "图片 1280 × 720",
    preview: "截图 1280 × 720",
    kind: "image",
    contentHash: "seed-image-1",
    createdAt,
    lastUsedAt: createdAt,
    useCount: 3,
    isFavorite: true,
    sourceAppName: "Snipping Tool",
    sourceAppIcon: null,
    sourceAppPath: null,
    imageWidth: 1280,
    imageHeight: 720
  };
}

function createFileSeed(now: number): ClipItem {
  const filePaths = [
    "C:\\Users\\jiangbeichen\\Pictures\\clipflow-preview.png",
    "C:\\Users\\jiangbeichen\\Documents\\Project brief.pdf"
  ];
  const createdAt = new Date(now - 180_000).toISOString();
  return {
    id: "file-1",
    text: filePaths.join("\n"),
    preview: "2 个文件 · clipflow-preview.png, Project brief.pdf",
    kind: "file",
    contentHash: "seed-file-1",
    createdAt,
    lastUsedAt: null,
    useCount: 0,
    isFavorite: false,
    sourceAppName: "Explorer",
    sourceAppIcon: null,
    sourceAppPath: null,
    fileCount: filePaths.length,
    filePaths
  };
}

function createRichTextSeed(now: number): ClipItem {
  const createdAt = new Date(now - 240_000).toISOString();
  return {
    id: "rich-1",
    text: "会议纪要: ClipFlow 支持富文本复制",
    preview: "会议纪要: ClipFlow 支持富文本复制",
    kind: "richText",
    contentHash: "seed-rich-1",
    createdAt,
    lastUsedAt: null,
    useCount: 0,
    sourceAppName: "Word",
    sourceAppIcon: null,
    sourceAppPath: null,
    richHtml: "<strong>会议纪要</strong>: ClipFlow 支持富文本复制"
  };
}

function createTrashSeed(now: number): ClipItem {
  const createdAt = new Date(now - 1_320_000).toISOString();
  return {
    id: "trash-1",
    text: "已删除的临时剪切板内容",
    preview: "已删除的临时剪切板内容",
    kind: "text",
    contentHash: "seed-trash-1",
    createdAt,
    deletedAt: new Date(now - 420_000).toISOString(),
    lastUsedAt: null,
    useCount: 0,
    sourceAppName: "Notes",
    sourceAppIcon: null,
    sourceAppPath: null
  };
}
