import { describe, expect, it } from "vitest";
import type { ClipItem } from "./types";
import {
  classifyClip,
  createClipPreview,
  filterClips,
  moveSelection,
  normalizeClipText
} from "./clipSearch";

const clips: ClipItem[] = [
  {
    id: "1",
    text: "cargo tauri dev --target x86_64-pc-windows-msvc",
    preview: "cargo tauri dev --target x86_64-pc-windows-msvc",
    kind: "code",
    contentHash: "hash-1",
    createdAt: "2026-05-02T10:00:00.000Z",
    lastUsedAt: null,
    useCount: 0
  },
  {
    id: "2",
    text: "https://m3.material.io/blog/building-with-m3-expressive",
    preview: "https://m3.material.io/blog/building-with-m3-expressive",
    kind: "link",
    contentHash: "hash-2",
    createdAt: "2026-05-02T10:03:00.000Z",
    lastUsedAt: "2026-05-02T10:08:00.000Z",
    useCount: 3
  },
  {
    id: "3",
    text: "Material 3 Expressive token plan",
    preview: "Material 3 Expressive token plan",
    kind: "text",
    contentHash: "hash-3",
    createdAt: "2026-05-02T10:05:00.000Z",
    lastUsedAt: null,
    useCount: 0,
    isFavorite: true
  },
  {
    id: "4",
    text: "图片 1280 × 720",
    preview: "截图 1280 × 720",
    kind: "image",
    contentHash: "hash-4",
    createdAt: "2026-05-02T10:07:00.000Z",
    lastUsedAt: null,
    useCount: 0,
    imageWidth: 1280,
    imageHeight: 720
  },
  {
    id: "5",
    text: "C:\\Users\\jiangbeichen\\Pictures\\clipflow-preview.png",
    preview: "1 个文件 · clipflow-preview.png",
    kind: "file",
    contentHash: "hash-5",
    createdAt: "2026-05-02T10:09:00.000Z",
    lastUsedAt: null,
    useCount: 0,
    fileCount: 1,
    filePaths: ["C:\\Users\\jiangbeichen\\Pictures\\clipflow-preview.png"]
  }
];

describe("normalizeClipText", () => {
  it("trims text and collapses repeated whitespace", () => {
    expect(normalizeClipText("  hello\n\n   world\t ")).toBe("hello world");
  });

  it("returns empty string for whitespace-only values", () => {
    expect(normalizeClipText(" \n\t ")).toBe("");
  });
});

describe("createClipPreview", () => {
  it("keeps short text intact", () => {
    expect(createClipPreview("short text", 20)).toBe("short text");
  });

  it("truncates long text with an ellipsis", () => {
    expect(createClipPreview("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghi…");
  });
});

describe("classifyClip", () => {
  it("classifies urls as links", () => {
    expect(classifyClip("https://tauri.app")).toBe("link");
  });

  it("classifies command-like text as code", () => {
    expect(classifyClip("cargo tauri dev --target x86_64-pc-windows-msvc")).toBe("code");
  });

  it("classifies prose as text", () => {
    expect(classifyClip("Material 3 Expressive token plan")).toBe("text");
  });

  it("classifies file paths as files", () => {
    expect(classifyClip("C:\\Users\\jiangbeichen\\Pictures\\clipflow-preview.png")).toBe("file");
  });
});

describe("filterClips", () => {
  it("matches query against text regardless of case", () => {
    expect(filterClips(clips, { query: "TAURI", filter: "all" }).map((clip) => clip.id)).toEqual(["1"]);
  });

  it("filters links", () => {
    expect(filterClips(clips, { query: "", filter: "link" }).map((clip) => clip.id)).toEqual(["2"]);
  });

  it("filters code clips", () => {
    expect(filterClips(clips, { query: "", filter: "code" }).map((clip) => clip.id)).toEqual(["1"]);
  });

  it("filters images and files", () => {
    expect(filterClips(clips, { query: "", filter: "image" }).map((clip) => clip.id)).toEqual(["4"]);
    expect(filterClips(clips, { query: "", filter: "file" }).map((clip) => clip.id)).toEqual(["5"]);
  });

  it("filters favorite clips", () => {
    expect(filterClips(clips, { query: "", filter: "favorite" }).map((clip) => clip.id)).toEqual(["3"]);
  });

  it("prioritizes recently used clips", () => {
    expect(filterClips(clips, { query: "", filter: "recent" }).map((clip) => clip.id)).toEqual(["2"]);
  });
});

describe("moveSelection", () => {
  it("wraps upward from the first item", () => {
    expect(moveSelection(0, -1, 3)).toBe(2);
  });

  it("wraps downward from the last item", () => {
    expect(moveSelection(2, 1, 3)).toBe(0);
  });

  it("returns zero when list is empty", () => {
    expect(moveSelection(2, 1, 0)).toBe(0);
  });
});
