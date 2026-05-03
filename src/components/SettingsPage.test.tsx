import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Settings } from "../domain/types";
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
  colorPreset: "teal",
  customColor: "#0d9488",
  windowPosition: "remember",
  copySound: false,
  searchBoxPosition: "top",
  mousePasteTrigger: "doubleClick",
  deleteConfirmation: true,
  edgeAutoHide: false,
  capturePaused: false,
  themeMode: "system"
};

function renderSettingsPage(overrides: Partial<Settings> = {}) {
  const onUpdateSettings = vi.fn();
  render(
      <SettingsPage
        clipsCount={12}
        runtimeLabel="浏览器预览"
        settings={{ ...settings, ...overrides }}
        onBack={vi.fn()}
        onClearHistory={vi.fn()}
        onUpdateSettings={onUpdateSettings}
    />
  );
  return { onUpdateSettings };
}

describe("SettingsPage", () => {
  it("renders the five required settings sections", () => {
    renderSettingsPage();
    const nav = within(screen.getByRole("navigation", { name: "设置分类" }));

    expect(nav.getByRole("button", { name: /剪切板/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /历史记录/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /通用/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /快捷键/ })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /关于/ })).toBeInTheDocument();
  });

  it("does not expose removed clipboard toggles", () => {
    renderSettingsPage();

    expect(screen.queryByText("剪切板记录默认开启")).not.toBeInTheDocument();
    expect(screen.queryByText("复制文本后会自动进入历史记录，无需额外配置。")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "自动记录文本" })).not.toBeInTheDocument();
    expect(screen.queryByText("记录状态")).not.toBeInTheDocument();
    expect(screen.queryByText("内容类型")).not.toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /开源地址/ })).toHaveAttribute(
      "href",
      "https://github.com/BeiChen-CN/ClipFlow"
    );
    expect(screen.getByText(/面向 Windows 桌面的剪切板管理器/)).toBeInTheDocument();
    expect(screen.queryByText("快速搜索")).not.toBeInTheDocument();
    expect(screen.queryByText("工作方式")).not.toBeInTheDocument();
    expect(screen.queryByText("隐私边界")).not.toBeInTheDocument();
    expect(screen.queryByText("数据存储")).not.toBeInTheDocument();
    expect(screen.queryByText("运行环境")).not.toBeInTheDocument();
  });

  it("updates clipboard behavior settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /窗口位置/ }));
    await user.click(screen.getByRole("option", { name: "跟随鼠标" }));
    await user.click(screen.getByRole("switch", { name: "复制音效" }));
    await user.click(screen.getByRole("button", { name: /搜索框位置/ }));
    await user.click(screen.getByRole("option", { name: "底部" }));
    await user.click(screen.getByRole("button", { name: /自动粘贴/ }));
    await user.click(screen.getByRole("option", { name: "单击" }));
    await user.click(screen.getByRole("switch", { name: "删除确认" }));
    await user.click(screen.getByRole("switch", { name: "边缘自动隐藏" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ windowPosition: "followMouse" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ copySound: true });
    expect(onUpdateSettings).toHaveBeenCalledWith({ searchBoxPosition: "bottom" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ mousePasteTrigger: "singleClick" });
    expect(onUpdateSettings).toHaveBeenCalledWith({ deleteConfirmation: false });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ edgeAutoHide: true });
  });

  it("updates optional clipboard filter visibility", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage({ optionalFilters: ["link"] });

    await user.click(screen.getByRole("switch", { name: "富文本" }));
    await user.click(screen.getByRole("switch", { name: "链接" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ optionalFilters: ["link", "richText"] });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ optionalFilters: [] });
  });

  it("updates history limit, retention days, and clamps trash retention to at least one day", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /历史记录/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /历史上限/ }), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /保留时长/ }), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /回收站保留/ }), {
      target: { value: "0" }
    });

    expect(screen.getByText("12/100 条")).toBeInTheDocument();
    expect(onUpdateSettings).toHaveBeenCalledWith({ historyLimit: 0 });
    expect(onUpdateSettings).toHaveBeenCalledWith({ retentionDays: 0 });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ trashRetentionDays: 1 });
  });

  it("uses custom stepper buttons for numeric settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /历史记录/ }));
    await user.click(screen.getByRole("button", { name: "历史上限增加" }));
    await user.click(screen.getByRole("button", { name: "保留时长减少" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ historyLimit: 101 });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ retentionDays: 29 });
  });

  it("updates startup, color preset, and custom shortcut settings", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /通用/ }));
    await user.click(screen.getByRole("switch", { name: "开机自启动" }));
    await user.click(screen.getByRole("radio", { name: "蓝色" }));

    await user.click(screen.getByRole("button", { name: /快捷键/ }));
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

  it("updates the custom color preset", async () => {
    const user = userEvent.setup();
    const { onUpdateSettings } = renderSettingsPage();

    await user.click(screen.getByRole("button", { name: /通用/ }));
    fireEvent.change(screen.getByLabelText("选择自定义颜色"), {
      target: { value: "#22c55e" }
    });
    await user.click(screen.getByRole("radio", { name: "自定义" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({ colorPreset: "custom", customColor: "#22c55e" });
  });
});
