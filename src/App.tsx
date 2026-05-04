import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, Database, Monitor, ShieldCheck } from "lucide-react";
import { DesktopResizeZones } from "./components/DesktopResizeZones";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPage } from "./components/SettingsPage";
import { createDemoClips, defaultSettings } from "./demoData";
import {
  applyDesktopWindowRoute,
  initializeDesktopWindow,
  minimizeDesktopWindow,
  rememberDesktopWindowBounds,
  startDesktopWindowDrag
} from "./domain/desktopWindow";
import type { DesktopWindowRoute } from "./domain/desktopWindow";
import type { RouteDirection } from "./domain/motion";
import { createMotionSettings } from "./domain/motion";
import { createThemeStyle, normalizeHexColor, readCustomColor } from "./domain/theme";
import type { ClipItem, MotionPreset, OptionalClipFilter, Settings, SettingsPatch } from "./domain/types";
import { tauriClient } from "./tauriClient";
import "./styles/app.css";

const desktopRuntime = tauriClient.isAvailable();
const browserSettingsKey = "clipflow.settings.v1";
const motionPresetIds: MotionPreset[] = ["a", "b", "c", "d"];
const optionalFilterIds: OptionalClipFilter[] = ["link", "code", "richText", "recent"];

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const pathnameRef = useRef(pathname);
  const [routeDirection, setRouteDirection] = useState<RouteDirection>(() =>
    resolveRouteDirection("/", pathname)
  );
  const [clips, setClips] = useState<ClipItem[]>(() => (desktopRuntime ? [] : createDemoClips()));
  const [settings, setSettings] = useState<Settings>(() =>
    desktopRuntime ? defaultSettings : readBrowserSettings()
  );
  const [loading, setLoading] = useState(desktopRuntime);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState(desktopRuntime ? "正在连接桌面运行时" : "浏览器预览模式");
  const [focusSignal, setFocusSignal] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const windowRouteRef = useRef<DesktopWindowRoute>(resolveDesktopWindowRoute(pathname));
  const resizeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const updatePathname = useCallback((nextPathname: string) => {
    const previousPathname = pathnameRef.current;
    if (previousPathname === nextPathname) {
      return;
    }

    setRouteDirection(resolveRouteDirection(previousPathname, nextPathname));
    pathnameRef.current = nextPathname;
    setPathname(nextPathname);
  }, []);

  useEffect(() => {
    function handlePopState() {
      updatePathname(window.location.pathname);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [updatePathname]);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    void initializeDesktopWindow(windowRouteRef.current).catch(reportDesktopWindowError);
  }, []);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    const nextRoute = resolveDesktopWindowRoute(pathname);
    const previousRoute = windowRouteRef.current;
    if (previousRoute === nextRoute) {
      return;
    }

    if (resizeTimerRef.current) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }

    windowRouteRef.current = nextRoute;
    void rememberDesktopWindowBounds(previousRoute)
      .catch(reportDesktopWindowError)
      .finally(() => {
        void applyDesktopWindowRoute(nextRoute).catch(reportDesktopWindowError);
      });
  }, [pathname]);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    const rememberCurrentRoute = () => {
      if (resizeTimerRef.current) {
        window.clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = window.setTimeout(() => {
        void rememberDesktopWindowBounds(windowRouteRef.current).catch(reportDesktopWindowError);
      }, 180);
    };

    window.addEventListener("resize", rememberCurrentRoute);
    return () => {
      if (resizeTimerRef.current) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      window.removeEventListener("resize", rememberCurrentRoute);
      void rememberDesktopWindowBounds(windowRouteRef.current).catch(reportDesktopWindowError);
    };
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      if (path === pathnameRef.current) {
        return;
      }

      window.history.pushState({}, "", path);
      updatePathname(path);
    },
    [updatePathname]
  );

  const loadData = useCallback(async (silent = false) => {
    if (!desktopRuntime) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const [activeClips, trashClips, nextSettings] = await Promise.all([
        tauriClient.listClips(),
        tauriClient.listClips("", "trash"),
        tauriClient.getSettings()
      ]);
      setClips([...activeClips, ...trashClips]);
      setSettings(nextSettings);
      setError(null);
      if (!silent) {
        setNotice("桌面运行中");
      }
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    let cleanup: (() => void) | null = null;
    void loadData();
    void tauriClient
      .subscribeToAppEvents({
        onClipsChanged: () => void loadData(true),
        onPanelShown: () => setFocusSignal((value) => value + 1),
        onSettingsChanged: setSettings
      })
      .then((unlisten) => {
        cleanup = unlisten;
      })
      .catch((nextError) => setError(readError(nextError)));

    return () => {
      cleanup?.();
    };
  }, [loadData]);

  const stats = useMemo(() => createStats(clips), [clips]);
  const activeClipsCount = useMemo(() => clips.filter((clip) => !clip.deletedAt).length, [clips]);
  const themeStyle = useMemo(() => createThemeStyle(settings), [settings]);
  const routeMotion = useMemo(() => createMotionSettings(settings.motionPreset), [settings.motionPreset]);

  const runDesktopAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setBusyLabel(label);
      try {
        await action();
        await loadData(true);
        setNotice(label);
        setError(null);
      } catch (nextError) {
        setError(readError(nextError));
      } finally {
        setBusyLabel(null);
      }
    },
    [loadData]
  );

  const markLocalClipUsed = useCallback((id: string, label: string) => {
    const usedAt = new Date().toISOString();
    setClips((items) =>
      items.map((clip) =>
        clip.id === id
          ? { ...clip, lastUsedAt: usedAt, useCount: clip.useCount + 1 }
          : clip
      )
    );
    setNotice(label);
  }, []);

  const handleCopyClip = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("已复制到剪切板", () => tauriClient.copyClip(id));
      }

      markLocalClipUsed(id, "已模拟复制");
      return Promise.resolve();
    },
    [markLocalClipUsed, runDesktopAction]
  );

  const handlePasteClip = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("已粘贴到当前窗口", () => tauriClient.pasteClip(id));
      }

      markLocalClipUsed(id, "已模拟粘贴");
      return Promise.resolve();
    },
    [markLocalClipUsed, runDesktopAction]
  );

  const handleDeleteClip = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("已移入回收站", () => tauriClient.deleteClip(id));
      }

      setClips((items) =>
        items.map((clip) =>
          clip.id === id ? { ...clip, deletedAt: new Date().toISOString() } : clip
        )
      );
      setNotice("已移入回收站");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handlePermanentlyDeleteClip = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("已彻底删除", () => tauriClient.permanentlyDeleteClip(id));
      }

      setClips((items) => items.filter((clip) => clip.id !== id));
      setNotice("已彻底删除");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handleRestoreClip = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("已从回收站恢复", () => tauriClient.restoreClip(id));
      }

      setClips((items) =>
        items.map((clip) => (clip.id === id ? { ...clip, deletedAt: null } : clip))
      );
      setNotice("已从回收站恢复");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handleUpdateClipText = useCallback(
    (id: string, text: string) => {
      if (desktopRuntime) {
        return runDesktopAction("内容已更新", () => tauriClient.updateClipText(id, text));
      }

      setClips((items) =>
        items.map((clip) =>
          clip.id === id
            ? {
                ...clip,
                text,
                preview: text.length > 96 ? `${text.slice(0, 95)}…` : text
              }
            : clip
        )
      );
      setNotice("内容已更新");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      if (desktopRuntime) {
        return runDesktopAction("收藏状态已更新", () => tauriClient.toggleFavorite(id));
      }

      setClips((items) =>
        items.map((clip) =>
          clip.id === id ? { ...clip, isFavorite: !clip.isFavorite } : clip
        )
      );
      setNotice("收藏状态已更新");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handleClearHistory = useCallback(() => {
    if (desktopRuntime) {
      return runDesktopAction("历史已清空", tauriClient.clearHistory);
    }

    const deletedAt = new Date().toISOString();
    setClips((items) => items.map((clip) => ({ ...clip, deletedAt: clip.deletedAt ?? deletedAt })));
    setNotice("已移入回收站");
    return Promise.resolve();
  }, [runDesktopAction]);

  const handleUpdateSettings = useCallback(
    (patch: SettingsPatch) => {
      if (desktopRuntime) {
        return runDesktopAction("设置已更新", async () => {
          const nextSettings = await tauriClient.updateSettings(patch);
          setSettings(nextSettings);
        });
      }

      setSettings((current) => {
        const nextSettings = applySettingsPatch(current, patch);
        writeBrowserSettings(nextSettings);
        return nextSettings;
      });
      setNotice("设置已更新");
      return Promise.resolve();
    },
    [runDesktopAction]
  );

  const handleRefresh = useCallback(() => {
    if (desktopRuntime) {
      return loadData(true);
    }

    setClips(createDemoClips());
    setNotice("演示数据已刷新");
    return Promise.resolve();
  }, [loadData]);

  const handleHidePanel = useCallback(() => {
    if (desktopRuntime) {
      return runDesktopAction("面板已隐藏", tauriClient.hidePanel);
    }

    navigateTo("/");
    return Promise.resolve();
  }, [navigateTo, runDesktopAction]);

  const handleStartWindowDrag = useCallback(() => {
    if (!desktopRuntime) {
      return Promise.resolve();
    }

    return startDesktopWindowDrag().catch(reportDesktopWindowError);
  }, []);

  const handleMinimizeWindow = useCallback(() => {
    if (!desktopRuntime) {
      return Promise.resolve();
    }

    return minimizeDesktopWindow().catch(reportDesktopWindowError);
  }, []);

  const handleTogglePanelPinned = useCallback(() => {
    return handleUpdateSettings({ panelPinned: !settings.panelPinned });
  }, [handleUpdateSettings, settings.panelPinned]);

  const handleOpenSettings = useCallback(() => {
    navigateTo("/settings");
  }, [navigateTo]);

  const handleBackToClipboard = useCallback(() => {
    navigateTo("/");
  }, [navigateTo]);

  const routeMotionProps = prefersReducedMotion
    ? { initial: false as const }
    : {
        animate: "animate",
        custom: routeDirection,
        exit: "exit",
        initial: "initial",
        transition: routeMotion.routeTransition,
        variants: routeMotion.routeVariants
      };

  const routeContent = pathname === "/settings" ? (
        <motion.div
          key="settings"
          className={desktopRuntime ? "route-motion-layer desktop-runtime" : "route-motion-layer"}
          data-motion-preset={settings.motionPreset}
          {...routeMotionProps}
        >
      <SettingsPage
        clips={clips}
        clipsCount={activeClipsCount}
        settings={settings}
        style={themeStyle}
        onBack={handleBackToClipboard}
        onClearHistory={handleClearHistory}
        onCloseWindow={handleHidePanel}
        onMinimizeWindow={handleMinimizeWindow}
        onPermanentlyDeleteClip={handlePermanentlyDeleteClip}
        onRestoreClip={handleRestoreClip}
        onStartWindowDrag={handleStartWindowDrag}
        onUpdateSettings={handleUpdateSettings}
      />
        </motion.div>
  ) : (
    <motion.main
      key="clipboard"
      className={desktopRuntime ? "app-frame desktop-runtime" : "app-frame"}
      data-color={settings.colorPreset}
      data-motion-preset={settings.motionPreset}
      data-theme={settings.themeMode}
      style={themeStyle}
      {...routeMotionProps}
    >
      <div className="workspace">
        <SearchPanel
          clips={clips}
          settings={settings}
          loading={loading}
          error={error}
          focusSignal={focusSignal}
          onClearHistory={handleClearHistory}
          onCopyClip={handleCopyClip}
          onDeleteClip={handleDeleteClip}
          onPermanentlyDeleteClip={handlePermanentlyDeleteClip}
          onHidePanel={handleHidePanel}
          onPasteClip={handlePasteClip}
          onRestoreClip={handleRestoreClip}
          onToggleFavorite={handleToggleFavorite}
          onTogglePanelPinned={handleTogglePanelPinned}
          onUpdateClipText={handleUpdateClipText}
          onRefresh={handleRefresh}
          onOpenSettings={handleOpenSettings}
          onStartWindowDrag={handleStartWindowDrag}
        />

        <aside className="status-rail" aria-label="ClipFlow 状态">
          <StatusTile icon={<Monitor size={18} />} label="运行环境" value={desktopRuntime ? "桌面运行时" : "浏览器预览"} />
          <StatusTile icon={<Database size={18} />} label="历史容量" value={formatHistoryCount(activeClipsCount, settings.historyLimit)} />
          <StatusTile icon={<Activity size={18} />} label="最近使用" value={`${stats.usedCount} 条`} />
          <StatusTile icon={<ShieldCheck size={18} />} label="保留时长" value={formatRetentionDays(settings.retentionDays)} />
          <div className="notice-line" role="status">{notice}</div>
        </aside>
      </div>
    </motion.main>
  );

  return (
    <>
      <AnimatePresence initial={false} mode="popLayout" custom={routeDirection}>
        {routeContent}
      </AnimatePresence>
      {desktopRuntime ? <DesktopResizeZones /> : null}
    </>
  );
}

function StatusTile({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="status-tile">
      <span className="tile-icon" aria-hidden="true">{icon}</span>
      <span className="tile-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function createStats(clips: ClipItem[]) {
  return {
    usedCount: clips.filter((clip) => !clip.deletedAt && clip.useCount > 0).length
  };
}

function applySettingsPatch(settings: Settings, patch: SettingsPatch): Settings {
  return {
    ...settings,
    ...patch,
    hotkey: patch.shortcuts?.showPanel ?? patch.hotkey ?? settings.hotkey,
    shortcuts: {
      ...settings.shortcuts,
      ...patch.shortcuts
    },
    colorPreset: patch.colorPreset ?? settings.colorPreset,
    customColor: normalizeHexColor(patch.customColor) ?? readCustomColor(settings),
    motionPreset: normalizeMotionPreset(patch.motionPreset)
      ?? normalizeMotionPreset(settings.motionPreset)
      ?? defaultSettings.motionPreset,
    autoSortDuplicates: patch.autoSortDuplicates ?? settings.autoSortDuplicates ?? defaultSettings.autoSortDuplicates,
    minimizeOnClose: patch.minimizeOnClose ?? settings.minimizeOnClose ?? defaultSettings.minimizeOnClose,
    panelPinned: patch.panelPinned !== undefined
      ? patch.panelPinned
      : settings.panelPinned,
    historyLimit: patch.historyLimit !== undefined
      ? Math.max(0, Math.trunc(patch.historyLimit))
      : settings.historyLimit,
    retentionDays: patch.retentionDays !== undefined
      ? Math.max(0, Math.trunc(patch.retentionDays))
      : settings.retentionDays,
    trashRetentionDays: patch.trashRetentionDays !== undefined
      ? clampTrashRetentionDays(patch.trashRetentionDays)
      : settings.trashRetentionDays,
    optionalFilters: patch.optionalFilters !== undefined
      ? normalizeOptionalFilters(patch.optionalFilters)
      : normalizeOptionalFilters(settings.optionalFilters),
    edgeAutoHide: patch.edgeAutoHide !== undefined ? patch.edgeAutoHide : settings.edgeAutoHide
  };
}

function normalizeMotionPreset(value: unknown): MotionPreset | null {
  return motionPresetIds.includes(value as MotionPreset) ? value as MotionPreset : null;
}

function clampTrashRetentionDays(value: number): number {
  return Math.min(30, Math.max(1, Math.trunc(value)));
}

function normalizeOptionalFilters(filters: unknown): OptionalClipFilter[] {
  if (!Array.isArray(filters)) {
    return [];
  }

  const selected = new Set(filters);
  return optionalFilterIds.filter((filter) => selected.has(filter));
}

function readBrowserSettings(): Settings {
  try {
    const rawSettings = window.localStorage.getItem(browserSettingsKey);
    if (!rawSettings) {
      return defaultSettings;
    }

    const parsedSettings = JSON.parse(rawSettings) as SettingsPatch;
    return applySettingsPatch(defaultSettings, parsedSettings);
  } catch {
    return defaultSettings;
  }
}

function writeBrowserSettings(settings: Settings) {
  try {
    window.localStorage.setItem(browserSettingsKey, JSON.stringify(settings));
  } catch {
    // 浏览器预览里 localStorage 可能被禁用，忽略即可。
  }
}

function resolveDesktopWindowRoute(pathname: string): DesktopWindowRoute {
  return pathname === "/settings" ? "settings" : "clipboard";
}

function resolveRouteDirection(fromPathname: string, toPathname: string): RouteDirection {
  const fromRoute = resolveDesktopWindowRoute(fromPathname);
  const toRoute = resolveDesktopWindowRoute(toPathname);

  if (fromRoute === toRoute) {
    return toRoute === "settings" ? "toSettings" : "toClipboard";
  }

  return toRoute === "settings" ? "toSettings" : "toClipboard";
}

function formatHistoryCount(count: number, limit: number): string {
  return limit === 0 ? `${count}/无限` : `${count}/${limit}`;
}

function formatRetentionDays(days: number): string {
  return days === 0 ? "永久保留" : `${days} 天`;
}

function readError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function reportDesktopWindowError(error: unknown) {
  console.warn("ClipFlow desktop window action failed", error);
}
