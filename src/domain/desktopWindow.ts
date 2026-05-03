export interface DesktopWindowSize {
  width: number;
  height: number;
}

export type DesktopWindowRoute = "clipboard" | "settings";

export type DesktopWindowBounds = DesktopWindowSize;

export type ResizeDirection =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

export const DESKTOP_MIN_WINDOW_SIZE = {
  width: 420,
  height: 520
} as const satisfies DesktopWindowSize;

export const CLIPBOARD_WINDOW_SIZE = {
  width: 520,
  height: 850
} as const satisfies DesktopWindowSize;

export const SETTINGS_WINDOW_SIZE = {
  width: 800,
  height: 600
} as const satisfies DesktopWindowSize;

export const DESKTOP_WINDOW_BOUNDS_STORAGE_KEY = "clipflow.desktopWindowBounds.v1";

type TauriGlobals = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

type TauriWindowHandle = {
  outerSize(): Promise<DesktopWindowSize>;
  scaleFactor(): Promise<number>;
  minimize(): Promise<void>;
  setMinSize(size: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
  startDragging(): Promise<void>;
  startResizeDragging(direction: ResizeDirection): Promise<void>;
};

type DesktopWindowBoundsMemory = Partial<Record<DesktopWindowRoute, DesktopWindowBounds>>;

export function resolveDesktopWindowSize(route: DesktopWindowRoute): DesktopWindowSize {
  return readDesktopWindowBoundsMemory(route) ?? defaultDesktopWindowSize(route);
}

export function readDesktopWindowBoundsMemory(route: DesktopWindowRoute): DesktopWindowBounds | null {
  const memory = readDesktopWindowBoundsMemoryMap();
  return normalizeDesktopWindowBounds(memory[route]) ?? null;
}

export function writeDesktopWindowBoundsMemory(
  route: DesktopWindowRoute,
  bounds: DesktopWindowBounds
): void {
  const normalized = normalizeDesktopWindowBounds(bounds);
  if (!normalized) {
    return;
  }

  writeDesktopWindowBoundsMemoryMap({
    ...readDesktopWindowBoundsMemoryMap(),
    [route]: normalized
  });
}

export function clearDesktopWindowBoundsMemory(): void {
  try {
    window.localStorage.removeItem(DESKTOP_WINDOW_BOUNDS_STORAGE_KEY);
  } catch {
    // localStorage can be disabled in browser preview.
  }
}

export async function initializeDesktopWindow(route: DesktopWindowRoute = "clipboard"): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  await window.setMinSize(
    new LogicalSize(DESKTOP_MIN_WINDOW_SIZE.width, DESKTOP_MIN_WINDOW_SIZE.height)
  );
  await setDesktopWindowSize(window, LogicalSize, resolveDesktopWindowSize(route));
}

export async function rememberDesktopWindowBounds(route: DesktopWindowRoute): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  writeDesktopWindowBoundsMemory(route, await readLogicalOuterSize(window));
}

export async function applyDesktopWindowRoute(route: DesktopWindowRoute): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  await setDesktopWindowSize(getCurrentWindow(), LogicalSize, resolveDesktopWindowSize(route));
}

export async function startDesktopResizeDrag(direction: ResizeDirection): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startResizeDragging(direction);
}

export async function startDesktopWindowDrag(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

export async function minimizeDesktopWindow(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

function defaultDesktopWindowSize(route: DesktopWindowRoute): DesktopWindowSize {
  return route === "settings" ? SETTINGS_WINDOW_SIZE : CLIPBOARD_WINDOW_SIZE;
}

async function setDesktopWindowSize(
  window: Pick<TauriWindowHandle, "setSize">,
  LogicalSize: new (width: number, height: number) => unknown,
  size: DesktopWindowSize
) {
  await window.setSize(new LogicalSize(size.width, size.height));
}

async function readLogicalOuterSize(window: Pick<TauriWindowHandle, "outerSize" | "scaleFactor">) {
  const [outerSize, scaleFactor] = await Promise.all([window.outerSize(), window.scaleFactor()]);
  const divisor = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;

  return {
    width: Math.round(outerSize.width / divisor),
    height: Math.round(outerSize.height / divisor)
  };
}

function readDesktopWindowBoundsMemoryMap(): DesktopWindowBoundsMemory {
  try {
    const rawValue = window.localStorage.getItem(DESKTOP_WINDOW_BOUNDS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return isRecord(parsed) ? parsed as DesktopWindowBoundsMemory : {};
  } catch {
    return {};
  }
}

function writeDesktopWindowBoundsMemoryMap(memory: DesktopWindowBoundsMemory): void {
  try {
    window.localStorage.setItem(DESKTOP_WINDOW_BOUNDS_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // localStorage can be disabled in browser preview.
  }
}

function normalizeDesktopWindowBounds(value: unknown): DesktopWindowBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  const normalized = {
    width: Math.round(width),
    height: Math.round(height)
  };

  if (
    normalized.width < DESKTOP_MIN_WINDOW_SIZE.width ||
    normalized.height < DESKTOP_MIN_WINDOW_SIZE.height
  ) {
    return null;
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTauriAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as TauriGlobals;
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__);
}
