import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ClipFilter, ClipItem, Settings, SettingsPatch } from "./domain/types";

type TauriWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

interface AppEventHandlers {
  onClipsChanged: () => void;
  onPanelShown: () => void;
  onSettingsChanged: (settings: Settings) => void;
}

export const tauriClient = {
  isAvailable,
  captureText,
  captureImage,
  captureFiles,
  clearHistory,
  copyClip,
  deleteClip,
  getSettings,
  hidePanel,
  listClips,
  permanentlyDeleteClip,
  pasteClip,
  purgeTrash,
  restoreClip,
  showPanel,
  subscribeToAppEvents,
  toggleFavorite,
  updateClipText,
  updateSettings
};

function isAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as TauriWindow;
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__);
}

function listClips(query = "", filter: ClipFilter = "all"): Promise<ClipItem[]> {
  return call("list_clips", { query, filter });
}

function getSettings(): Promise<Settings> {
  return call("get_settings");
}

function captureText(text: string): Promise<ClipItem | null> {
  return call("capture_text", { text });
}

function captureImage(width: number, height: number, bytes: number[]): Promise<ClipItem | null> {
  return call("capture_image", { width, height, bytes });
}

function captureFiles(paths: string[]): Promise<ClipItem | null> {
  return call("capture_files", { paths });
}

function copyClip(id: string): Promise<ClipItem> {
  return call("copy_clip", { id });
}

function pasteClip(id: string): Promise<ClipItem> {
  return call("paste_clip", { id });
}

function deleteClip(id: string): Promise<void> {
  return call("delete_clip", { id });
}

function permanentlyDeleteClip(id: string): Promise<void> {
  return call("permanently_delete_clip", { id });
}

function restoreClip(id: string): Promise<ClipItem> {
  return call("restore_clip", { id });
}

function purgeTrash(): Promise<void> {
  return call("purge_trash");
}

function toggleFavorite(id: string): Promise<ClipItem> {
  return call("toggle_favorite", { id });
}

function updateClipText(id: string, text: string): Promise<ClipItem> {
  return call("update_clip_text", { id, text });
}

function clearHistory(): Promise<void> {
  return call("clear_history");
}

function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return call("update_settings", { patch });
}

function showPanel(): Promise<void> {
  return call("show_panel");
}

function hidePanel(): Promise<void> {
  return call("hide_panel");
}

async function subscribeToAppEvents(handlers: AppEventHandlers): Promise<UnlistenFn> {
  if (!isAvailable()) {
    return () => undefined;
  }

  const unlisteners = await Promise.all([
    listen("clips-changed", handlers.onClipsChanged),
    listen("panel-shown", handlers.onPanelShown),
    listen<Settings>("settings-changed", (event) => handlers.onSettingsChanged(event.payload))
  ]);

  return () => {
    unlisteners.forEach((unlisten) => unlisten());
  };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isAvailable()) {
    throw new Error("ClipFlow desktop runtime is not available.");
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(readCommandError(error));
  }
}

function readCommandError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
}
