import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClipItem, Settings } from "../domain/types";
import { SettingsPage } from "./SettingsPage";

const settings: Settings = {
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
  windowPosition: "remember",
  copySound: false,
  searchBoxPosition: "top",
  mousePasteTrigger: "doubleClick",
  deleteConfirmation: true,
  edgeAutoHide: false,
  capturePaused: false,
  themeMode: "system"
};

const deletedClip: ClipItem = {
  id: "trash-1",
  text: "deleted clip",
  preview: "deleted clip",
  kind: "text",
  contentHash: "hash-trash-1",
  createdAt: "2026-05-02T10:10:00.000Z",
  lastUsedAt: null,
  useCount: 0,
  deletedAt: "2026-05-02T10:10:00.000Z"
};

function renderSettingsPage(
  overrides: Partial<Settings> = {},
  clips: ClipItem[] = [deletedClip],
  options: {
    busyLabel?: string;
    onCloseWindow?: () => void;
    onMinimizeWindow?: () => void;
  } = {}
) {
  const onUpdateSettings = vi.fn();
  const onRestoreClip = vi.fn();
  const onPermanentlyDeleteClip = vi.fn();
  const onCloseWindow = options.onCloseWindow ?? vi.fn();
  const onMinimizeWindow = options.onMinimizeWindow ?? vi.fn();

  render(
    <SettingsPage
      clips={clips}
      clipsCount={12}
      busyLabel={options.busyLabel}
      runtimeLabel="浏览器预览"
      settings={{ ...settings, ...overrides }}
      onBack={vi.fn()}
      onClearHistory={vi.fn()}
      onCloseWindow={onCloseWindow}
      onPermanentlyDeleteClip={onPermanentlyDeleteClip}
      onMinimizeWindow={onMinimizeWindow}
      onRestoreClip={onRestoreClip}
      onUpdateSettings={onUpdateSettings}
    />
  );

  return {
    onCloseWindow,
    onMinimizeWindow,
    onPermanentlyDeleteClip,
    onRestoreClip,
    onUpdateSettings
  };
}

describe("SettingsPage", () => {
  it("renders the six required settings sections", () => {
    renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    expect(nav.getByRole("button", { name: /剪切板/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /历史记录/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /回收站/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /通用/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /快捷键/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /关于/ })).toBeInTheDocument();
  });

  it("keeps runtime and status labels out of the settings brand card", () => {
    renderSettingsPage({}, [deletedClip], { busyLabel: "设置已更新" });

    expect(screen.queryByText("设置已更新")).not.toBeInTheDocument();
    expect(screen.queryByText("本地偏好设置")).not.toBeInTheDocument();
  });

  it("renders desktop window controls when handlers are provided", async () => {
    const user = userEvent.setup();
    const onCloseWindow = vi.fn();
    const onMinimizeWindow = vi.fn();
    renderSettingsPage({}, [deletedClip], { onCloseWindow, onMinimizeWindow });

    await user.click(screen.getByRole("button", { name: "最小化窗口" }));
    await user.click(screen.getByRole("button", { name: "关闭设置窗口" }));

    expect(onMinimizeWindow).toHaveBeenCalledOnce();
    expect(onCloseWindow).toHaveBeenCalledOnce();
  });

  it("does not expose removed clipboard toggles", () => {
    renderSettingsPage();

    expect(screen.queryByText("剪切板记录默认开启")).not.toBeInTheDocument();
    expect(screen.queryByText("复制文本后会自动进入历史记录，无需额外配置。")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "自动记录文本" })).not.toBeInTheDocument();
    expect(screen.queryByText("记录状态")).not.toBeInTheDocument();
    expect(screen.queryByText("内容类型")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "回收站" })).not.toBeInTheDocument();
  });

  it("renders requested about content", async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /关于/ }));

    const appInfo = screen.getByLabelText("应用信息");
    expect(appInfo).toBeInTheDocument();
    expect(within(appInfo).getByText("ClipFlow")).toBeInTheDocument();
    expect(within(appInfo).getByText("软件介绍")).toBeInTheDocument();
    expect(screen.getByText("应用名称")).toBeInTheDocument();
    expect(screen.getByText("应用版本")).toBeInTheDocument();
    expect(screen.getByText(/面向 Windows 桌面的剪切板管理器/)).toBeInTheDocument();
  });

  it("updates clipboard behavior settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /剪切板/ }));
    await user.click(screen.getByRole("button", { name: /窗口位置/ }));
    await user.click(screen.getByRole("option", { name: "跟随鼠标" }));
    await user.click(screen.getByRole("switch", { name: "复制音效" }));
    await user.click(screen.getByRole("button", { name: /搜索框位置/ }));
    await user.click(screen.getByRole("option", { name: "底部" }));
    await user.click(screen.getByRole("button", { name: /自动粘贴/ }));
    await user.click(screen.getByRole("option", { name: "单击" }));
    await user.click(screen.getByRole("switch", { name: "重复内容置顶" }));
    await user.click(screen.getByRole("switch", { name: "删除确认" }));
    await user.click(screen.getByRole("switch", { name: "边缘自动隐藏" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ windowPosition: "followMouse" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ copySound: true });
    expect(onUpdateSettings).toHaveBeenCalledWith({ searchBoxPosition: "bottom" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ mousePasteTrigger: "singleClick" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ autoSortDuplicates: true });
    expect(onUpdateSettings).toHaveBeenCalledWith({ deleteConfirmation: false });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ edgeAutoHide: true });
  });

  it("updates history limit and retention days", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /历史记录/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /历史上限/ }), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /保留时长/ }), {
      target: { value: "0" }
    });

    expect(screen.getByText("12/100 条")).toBeInTheDocument();
    expect(onUpdateSettings).toHaveBeenCalledWith({ historyLimit: 0 });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ retentionDays: 0 });
  });

  it("updates trash retention and shows deleted content in the recycle bin section", async () => {
    const user = userEvent.setup();
    const { onPermanentlyDeleteClip, onRestoreClip, onUpdateSettings } = renderSettingsPage(
      { deleteConfirmation: false },
      [deletedClip]
    );
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /回收站/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /回收站保留/ }), {
      target: { value: "14" }
    });

    expect(screen.getByText("deleted clip")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "恢复剪切板" }));
    await user.click(screen.getByRole("button", { name: "彻底删除" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ trashRetentionDays: 14 });
    expect(onRestoreClip).toHaveBeenCalledWith("trash-1");
    expect(onPermanentlyDeleteClip).toHaveBeenCalledWith("trash-1");
  });

  it("confirms recycle bin permanent deletion with the custom dialog", async () => {
    const user = userEvent.setup();
    const { onPermanentlyDeleteClip } = renderSettingsPage({ deleteConfirmation: true }, [deletedClip]);
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /回收站/ }));
    await user.click(screen.getByRole("button", { name: "彻底删除" }));

    const dialog = screen.getByRole("alertdialog");
    expect(onPermanentlyDeleteClip).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "删除" }));

    expect(onPermanentlyDeleteClip).toHaveBeenCalledWith("trash-1");
  });

  it("uses custom stepper buttons for numeric settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /历史记录/ }));
    await user.click(screen.getByRole("button", { name: "历史上限增加" }));
    await user.click(screen.getByRole("button", { name: "保留时长减少" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ historyLimit: 101 });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ retentionDays: 29 });
  });

  it("updates tray and taskbar icon visibility settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /通用/ }));
    const traySwitch = screen.getByRole("switch", { name: "显示菜单栏图标" });
    const taskbarSwitch = screen.getByRole("switch", { name: "显示任务栏图标" });
    const minimizeOnCloseSwitch = screen.getByRole("switch", { name: "关闭最小化到托盘" });

    expect(traySwitch).toHaveAttribute("aria-checked", "true");
    expect(taskbarSwitch).toHaveAttribute("aria-checked", "true");
    expect(minimizeOnCloseSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("控制 Windows 托盘/通知区图标是否显示")).toBeInTheDocument();
    expect(screen.getByText("控制主窗口是否显示在 Windows 任务栏")).toBeInTheDocument();

    await user.click(traySwitch);
    await user.click(taskbarSwitch);
    await user.click(minimizeOnCloseSwitch);

    expect(onUpdateSettings).toHaveBeenCalledWith({ showTrayIcon: false });
    expect(onUpdateSettings).toHaveBeenCalledWith({ showTaskbarIcon: false });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ minimizeOnClose: false });
  });

  it("updates startup, color preset, and custom shortcut settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /通用/ }));
    await user.click(screen.getByRole("switch", { name: "开机自启动" }));
    await user.click(screen.getByRole("radio", { name: "蓝色" }));

    await user.click(nav.getByRole("button", { name: /快捷键/ }));
    expect(screen.queryByRole("textbox", { name: /呼出面板/ })).not.toBeInTheDocument();
    const showPanelShortcut = screen.getByRole("button", { name: "呼出面板快捷键" });
    await user.click(showPanelShortcut);
    expect(showPanelShortcut).toHaveTextContent("按下新的快捷键");
    fireEvent.keyDown(showPanelShortcut, {
      ctrlKey: true,
      key: " "
    });

    expect(onUpdateSettings).toHaveBeenCalledWith({ launchOnStartup: true });
    expect(onUpdateSettings).toHaveBeenCalledWith({ colorPreset: "blue" });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ shortcuts: { showPanel: "Ctrl+Space" } });
  });

  it("updates the motion preset from general settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /通用/ }));
    await user.click(screen.getByRole("radio", { name: "弹性" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ motionPreset: "d" });
  });

  it("updates the custom color preset", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    await user.click(nav.getByRole("button", { name: /通用/ }));
    fireEvent.change(screen.getByLabelText("选择自定义颜色"), {
      target: { value: "#22c55e" }
    });
    await user.click(screen.getByRole("radio", { name: "自定义" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ colorPreset: "custom", customColor: "#22c55e" });
  });
});
