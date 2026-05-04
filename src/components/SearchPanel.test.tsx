import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClipItem, Settings } from "../domain/types";
import { SearchPanel } from "./SearchPanel";

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
    lastUsedAt: null,
    useCount: 0
  }
];

const mediaClips: ClipItem[] = [
  {
    id: "image",
    text: "图片 800 × 600",
    preview: "截图 800 × 600",
    kind: "image",
    contentHash: "hash-image",
    createdAt: "2026-05-02T10:06:00.000Z",
    lastUsedAt: null,
    useCount: 0,
    imageWidth: 800,
    imageHeight: 600
  },
  {
    id: "file",
    text: "C:\\Users\\jiangbeichen\\Pictures\\mock.png",
    preview: "1 个文件 · mock.png",
    kind: "file",
    contentHash: "hash-file",
    createdAt: "2026-05-02T10:07:00.000Z",
    lastUsedAt: null,
    useCount: 0,
    fileCount: 1,
    filePaths: ["C:\\Users\\jiangbeichen\\Pictures\\mock.png"]
  }
];

const richClip: ClipItem = {
  id: "rich",
  text: "Material Expressive rich note",
  preview: "Material Expressive rich note",
  kind: "richText",
  contentHash: "hash-rich",
  createdAt: "2026-05-02T10:09:00.000Z",
  lastUsedAt: null,
  useCount: 0,
  richHtml: "<strong>Material Expressive</strong> rich note"
};

const trashClip: ClipItem = {
  ...clips[0]!,
  id: "trash",
  text: "deleted clip",
  preview: "deleted clip",
  contentHash: "hash-trash",
  deletedAt: "2026-05-02T10:10:00.000Z"
};

describe("SearchPanel", () => {
  it("focuses the search box on mount", () => {
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.getByRole("searchbox", { name: "搜索剪切板历史" })).toHaveFocus();
  });

  it("changes the panel motion key on focus signal without clearing the query", async () => {
    const user = userEvent.setup();
    const panelSettings = { ...settings, motionPreset: "d" as const };
    const baseProps = {
      clips,
      settings: panelSettings,
      onCopyClip: vi.fn(),
      onDeleteClip: vi.fn(),
      onPasteClip: vi.fn()
    };
    const { container, rerender } = render(<SearchPanel {...baseProps} focusSignal={0} />);

    await user.type(container.querySelector(".search-input") as HTMLInputElement, "material");

    expect(container.querySelector(".clip-shell")).toHaveAttribute("data-panel-motion-key", "d-0");

    rerender(<SearchPanel {...baseProps} focusSignal={1} />);

    expect(container.querySelector(".clip-shell")).toHaveAttribute("data-panel-motion-key", "d-1");
    expect(container.querySelector(".search-input")).toHaveValue("material");
  });

  it("keeps runtime and transient busy labels out of the clipboard chrome", () => {
    render(
      <SearchPanel
        busyLabel="历史已刷新"
        clips={clips}
        runtimeLabel="Tauri 桌面"
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.queryByText("Tauri 桌面")).not.toBeInTheDocument();
    expect(screen.queryByText("历史已刷新")).not.toBeInTheDocument();
  });

  it("does not render a visible edge auto-hide indicator", () => {
    const { container } = render(
      <SearchPanel
        clips={clips}
        settings={{ ...settings, edgeAutoHide: true }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(container.querySelector(".edge-dock-indicator")).toBeNull();
  });

  it("shows the copied time in clip metadata", () => {
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.getAllByText(/复制于/).length).toBeGreaterThan(0);
  });

  it("filters clips by search query", async () => {
    const user = userEvent.setup();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    await user.type(screen.getByRole("searchbox", { name: "搜索剪切板历史" }), "material");

    expect(screen.getByRole("option", { name: /building-with-m3-expressive/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("cargo tauri dev --target x86_64-pc-windows-msvc")).not.toBeInTheDocument()
    );
  });

  it("renders every matching clip in the scrollable history", () => {
    const manyClips = Array.from({ length: 10 }, (_, index): ClipItem => ({
      id: `many-${index}`,
      text: `history item ${index}`,
      preview: `history item ${index}`,
      kind: "text",
      contentHash: `hash-many-${index}`,
      createdAt: `2026-05-02T10:${String(index).padStart(2, "0")}:00.000Z`,
      lastUsedAt: null,
      useCount: 0
    }));

    render(
      <SearchPanel
        clips={manyClips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.getByRole("option", { name: /history item 9/ })).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/项匹配/)).toBeInTheDocument();
  });

  it("moves selection with arrow keys and pastes selected clip with Enter", async () => {
    const user = userEvent.setup();
    const onPasteClip = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={onPasteClip}
      />
    );

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPasteClip).toHaveBeenCalledWith("1");
  });

  it("copies selected clip with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const onCopyClip = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={onCopyClip}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onCopyClip).toHaveBeenCalledWith("2");
  });

  it("deletes selected clip with Delete", async () => {
    const user = userEvent.setup();
    const onDeleteClip = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={onDeleteClip}
        onPasteClip={vi.fn()}
      />
    );

    await user.keyboard("{Delete}");

    const dialog = screen.getByRole("alertdialog");
    expect(onDeleteClip).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "删除" }));

    expect(onDeleteClip).toHaveBeenCalledWith("2");
  });

  it("uses double-click as the default mouse paste action", async () => {
    const user = userEvent.setup();
    const onPasteClip = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={onPasteClip}
      />
    );

    await user.click(screen.getByRole("option", { name: /building-with-m3/ }));
    expect(onPasteClip).not.toHaveBeenCalled();

    await user.dblClick(screen.getByRole("option", { name: /building-with-m3/ }));
    expect(onPasteClip).toHaveBeenCalledWith("2");
  });

  it("supports single-click mouse paste and bottom search", async () => {
    const user = userEvent.setup();
    const onPasteClip = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={{ ...settings, mousePasteTrigger: "singleClick", searchBoxPosition: "bottom" }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={onPasteClip}
      />
    );

    await user.click(screen.getByRole("option", { name: /building-with-m3/ }));

    expect(onPasteClip).toHaveBeenCalledWith("2");
    expect(screen.getByRole("searchbox", { name: "搜索剪切板历史" })).toBeInTheDocument();
  });

  it("hides the search box when configured", () => {
    render(
      <SearchPanel
        clips={clips}
        settings={{ ...settings, searchBoxPosition: "hidden" }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.queryByRole("searchbox", { name: "搜索剪切板历史" })).not.toBeInTheDocument();
  });

  it("uses custom shortcut settings for clip actions", async () => {
    const user = userEvent.setup();
    const onPasteClip = vi.fn();
    const customSettings: Settings = {
      ...settings,
      shortcuts: {
        ...settings.shortcuts,
        pasteSelected: "Ctrl+P",
        nextItem: "Ctrl+J"
      }
    };
    render(
      <SearchPanel
        clips={clips}
        settings={customSettings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={onPasteClip}
      />
    );

    await user.keyboard("{Control>}j{/Control}");
    await user.keyboard("{Control>}p{/Control}");

    expect(onPasteClip).toHaveBeenCalledWith("1");
  });

  it("opens the standalone settings page", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onOpenSettings={onOpenSettings}
        onPasteClip={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "设置" }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("keeps optional filter tabs hidden until enabled in settings", () => {
    const { rerender } = render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );
    const filterRow = screen.getByRole("tablist", { name: "剪切板分类" });

    expect(within(filterRow).getByRole("tab", { name: "全部" })).toBeInTheDocument();
    expect(within(filterRow).getByRole("tab", { name: "文本" })).toBeInTheDocument();
    expect(within(filterRow).getByRole("tab", { name: "收藏" })).toBeInTheDocument();
    expect(within(filterRow).getByRole("tab", { name: "图片" })).toBeInTheDocument();
    expect(within(filterRow).getByRole("tab", { name: "文件" })).toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "链接" })).not.toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "代码" })).not.toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "富文本" })).not.toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "最近使用" })).not.toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "回收站" })).not.toBeInTheDocument();

    rerender(
      <SearchPanel
        clips={clips}
        settings={{ ...settings, optionalFilters: ["link", "trash"] }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(within(filterRow).getByRole("tab", { name: "链接" })).toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "回收站" })).not.toBeInTheDocument();
    expect(within(filterRow).queryByRole("tab", { name: "代码" })).not.toBeInTheDocument();
  });

  it("renders and filters image and file clips", async () => {
    const user = userEvent.setup();
    render(
      <SearchPanel
        clips={mediaClips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    expect(screen.getByText("截图 800 × 600")).toBeInTheDocument();
    expect(screen.getByText("1 个文件 · mock.png")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "图片" }));
    expect(screen.getByText("截图 800 × 600")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("1 个文件 · mock.png")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("tab", { name: "文件" }));
    expect(screen.getByText("1 个文件 · mock.png")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("截图 800 × 600")).not.toBeInTheDocument()
    );
  });

  it("filters rich text clips", async () => {
    const user = userEvent.setup();
    render(
      <SearchPanel
        clips={[...clips, richClip]}
        settings={{ ...settings, optionalFilters: ["richText"] }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    await user.click(screen.getByRole("tab", { name: "富文本" }));

    expect(screen.getByText("Material Expressive rich note")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("cargo tauri dev --target x86_64-pc-windows-msvc")).not.toBeInTheDocument()
    );
  });

  it("keeps recycle bin content out of the clipboard filter bar", () => {
    render(
      <SearchPanel
        clips={[...clips, trashClip]}
        settings={{ ...settings, optionalFilters: ["trash"] }}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    const filterRow = screen.getByRole("tablist", { name: "剪切板分类" });
    expect(within(filterRow).queryByRole("tab", { name: "回收站" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /deleted clip/ })).not.toBeInTheDocument();
  });

  it("edits a copied text clip inline", async () => {
    const user = userEvent.setup();
    const onUpdateClipText = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
        onUpdateClipText={onUpdateClipText}
      />
    );

    const clipRow = screen.getByRole("option", { name: /cargo tauri dev/ });
    await user.click(within(clipRow).getByRole("button", { name: "编辑内容" }));
    const editor = await screen.findByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "updated clipboard text");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onUpdateClipText).toHaveBeenCalledWith("1", "updated clipboard text");
  });

  it("highlights search matches and opens inline links", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <SearchPanel
        clips={[clips[1]!, { ...clips[0]!, preview: "Material 3 expressive plan", text: "Material 3 expressive plan" }]}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
      />
    );

    await user.type(screen.getByRole("searchbox", { name: "搜索剪切板历史" }), "material");
    expect(container.querySelector(".clip-highlight")).toHaveTextContent(/material/i);

    await user.click(screen.getByRole("button", { name: /打开链接 https:\/\/m3\.material\.io/ }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://m3.material.io/blog/building-with-m3-expressive",
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("toggles favorite clips and exposes the favorite filter", async () => {
    const user = userEvent.setup();
    const onToggleFavorite = vi.fn();
    render(
      <SearchPanel
        clips={[{ ...clips[0]!, isFavorite: true }, clips[1]!]}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />
    );

    await user.click(screen.getByRole("button", { name: "取消收藏" }));
    expect(onToggleFavorite).toHaveBeenCalledWith("1");

    await user.click(screen.getByRole("tab", { name: "收藏" }));
    expect(screen.getByText("cargo tauri dev --target x86_64-pc-windows-msvc")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("https://m3.material.io/blog/building-with-m3-expressive")).not.toBeInTheDocument()
    );
  });

  it("toggles panel pinning from the header action row", async () => {
    const user = userEvent.setup();
    const onTogglePanelPinned = vi.fn();
    render(
      <SearchPanel
        clips={clips}
        settings={settings}
        onCopyClip={vi.fn()}
        onDeleteClip={vi.fn()}
        onPasteClip={vi.fn()}
        onTogglePanelPinned={onTogglePanelPinned}
      />
    );

    await user.click(screen.getByRole("button", { name: "固定在最上层" }));
    expect(onTogglePanelPinned).toHaveBeenCalledOnce();
  });
});
