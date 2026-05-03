interface KeyboardShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

interface ParsedShortcut {
  alt: boolean;
  ctrl: boolean;
  key: string;
  meta: boolean;
  shift: boolean;
}

export function matchesShortcut(event: KeyboardShortcutEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  if (!parsed || shouldIgnoreEditableTextShortcut(event, parsed)) {
    return false;
  }

  return (
    normalizeKey(event.key) === parsed.key &&
    event.altKey === parsed.alt &&
    event.ctrlKey === parsed.ctrl &&
    event.metaKey === parsed.meta &&
    event.shiftKey === parsed.shift
  );
}

function parseShortcut(value: string): ParsedShortcut | null {
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) {
    return null;
  }

  const shortcut: ParsedShortcut = { alt: false, ctrl: false, key: normalizeKey(key), meta: false, shift: false };
  for (const part of parts) {
    if (!applyModifier(shortcut, part)) {
      return null;
    }
  }

  return shortcut.key ? shortcut : null;
}

function applyModifier(shortcut: ParsedShortcut, value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === "ctrl" || normalized === "control") {
    shortcut.ctrl = true;
    return true;
  }
  if (normalized === "cmd" || normalized === "command" || normalized === "meta") {
    shortcut.meta = true;
    return true;
  }
  if (normalized === "alt" || normalized === "option") {
    shortcut.alt = true;
    return true;
  }
  if (normalized === "shift") {
    shortcut.shift = true;
    return true;
  }
  return false;
}

function normalizeKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "esc") {
    return "escape";
  }
  if (normalized === "return") {
    return "enter";
  }
  if (normalized === "del") {
    return "delete";
  }
  if (normalized === "space" || normalized === "spacebar") {
    return " ";
  }
  return normalized;
}

function shouldIgnoreEditableTextShortcut(
  event: KeyboardShortcutEvent,
  shortcut: ParsedShortcut
): boolean {
  if (!isEditableTarget(event.target)) {
    return false;
  }

  return !shortcut.alt && !shortcut.ctrl && !shortcut.meta && shortcut.key.length === 1;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea";
}
