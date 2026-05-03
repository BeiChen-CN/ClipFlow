import type { ClipFilter, ClipItem, ClipKind } from "./types";

export function normalizeClipText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function createClipPreview(text: string, maxLength = 96): string {
  const normalized = normalizeClipText(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function classifyClip(text: string): ClipKind {
  if (isLikelyFileList(text.trim())) {
    return "file";
  }

  const normalized = normalizeClipText(text);

  if (/^https?:\/\/\S+$/i.test(normalized)) {
    return "link";
  }

  if (
    /(^|\s)(cargo|npm|pnpm|yarn|git|winget|powershell|cmd|rustup|node)\s/i.test(normalized) ||
    /(--[a-z0-9-]+|&&|\|\||=>|::|[{}[\]();])/.test(normalized)
  ) {
    return "code";
  }

  return "text";
}

export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s<>"']+/gi), (match) =>
    match[0].replace(/[),.;!?，。！？）]+$/u, "")
  );
}

export function filterClips(
  clips: ClipItem[],
  options: { query: string; filter: ClipFilter }
): ClipItem[] {
  const query = normalizeClipText(options.query).toLowerCase();

  return clips
    .filter((clip) => matchesFilter(clip, options.filter))
    .filter((clip) => {
      if (!query) {
        return true;
      }

      return searchableText(clip).toLowerCase().includes(query);
    })
    .sort((left, right) => sortByMostRelevant(left, right, options.filter));
}

export function moveSelection(currentIndex: number, delta: -1 | 1, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  return (currentIndex + delta + itemCount) % itemCount;
}

function matchesFilter(clip: ClipItem, filter: ClipFilter): boolean {
  if (filter === "all") {
    return !clip.deletedAt;
  }

  if (filter === "trash") {
    return Boolean(clip.deletedAt);
  }

  if (clip.deletedAt) {
    return false;
  }

  if (filter === "recent") {
    return clip.useCount > 0 || clip.lastUsedAt !== null;
  }

  if (filter === "favorite") {
    return Boolean(clip.isFavorite);
  }

  return clip.kind === filter;
}

function sortByMostRelevant(left: ClipItem, right: ClipItem, filter: ClipFilter): number {
  if (filter === "trash") {
    return compareDates(right.deletedAt ?? right.createdAt, left.deletedAt ?? left.createdAt);
  }

  if (filter === "recent") {
    return compareDates(right.lastUsedAt ?? right.createdAt, left.lastUsedAt ?? left.createdAt);
  }

  return compareDates(right.createdAt, left.createdAt);
}

function isLikelyFileList(value: string): boolean {
  const paths = value.split(/\s*[;\n]\s*|\s{2,}/).filter(Boolean);
  const candidates = paths.length > 1 ? paths : [value];
  return candidates.every((candidate) => isLikelyFilePath(candidate.trim()));
}

function isLikelyFilePath(value: string): boolean {
  return (
    /^[a-z]:[\\/][^<>:"|?*]+/i.test(value) ||
    /^\\\\[^<>:"|?*]+\\[^<>:"|?*]+/.test(value) ||
    /^\/([^/\0]+\/)+[^/\0]+/.test(value)
  );
}

function compareDates(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function searchableText(clip: ClipItem): string {
  return [
    clip.text,
    clip.preview,
    clip.richHtml ?? "",
    clip.sourceAppName ?? "",
    clip.sourceAppPath ?? "",
    ...(clip.filePaths ?? [])
  ].join(" ");
}
