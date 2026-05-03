import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Clipboard,
  Clock3,
  ExternalLink,
  HardDrive,
  Info,
  Keyboard,
  Moon,
  Monitor,
  MousePointerClick,
  Palette,
  Power,
  Search,
  Sun,
  Trash2,
  Volume2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeHexColor, readCustomColor } from "../domain/theme";
import type {
  ColorPreset,
  MousePasteTrigger,
  OptionalClipFilter,
  SearchBoxPosition,
  Settings,
  SettingsPatch,
  SettingsShortcuts,
  WindowPositionMode
} from "../domain/types";
import { InfoRow, NumberRow, RowTitle, SelectRow, SwitchRow } from "./SettingsPageRows";

type SectionId = "clipboard" | "history" | "general" | "hotkeys" | "about";
type UpdateSettings = (patch: SettingsPatch) => void | Promise<void>;
type PageAction = () => void | Promise<void>;

export interface SettingsContentProps {
  activeId: SectionId;
  clipsCount: number;
  settings: Settings;
  onClearHistory?: PageAction;
  onUpdateSettings: UpdateSettings;
}

const colorOptions: Array<{ id: ColorPreset; label: string; swatch: string }> = [
  { id: "teal", label: "青绿", swatch: "#0d9488" },
  { id: "blue", label: "蓝色", swatch: "#2563eb" },
  { id: "indigo", label: "靛蓝", swatch: "#4f46e5" },
  { id: "violet", label: "紫色", swatch: "#7c3aed" },
  { id: "rose", label: "玫红", swatch: "#e11d48" },
  { id: "coral", label: "珊瑚", swatch: "#ea580c" },
  { id: "amber", label: "琥珀", swatch: "#d97706" },
  { id: "slate", label: "石墨", swatch: "#475569" }
];

const shortcutRows: Array<{ key: keyof SettingsShortcuts; label: string; description: string }> = [
  { key: "showPanel", label: "呼出面板", description: "打开 ClipFlow 主面板" },
  { key: "pasteSelected", label: "粘贴选中", description: "把当前选中项粘贴到前台窗口" },
  { key: "copySelected", label: "复制选中", description: "只复制，不立即粘贴" },
  { key: "deleteSelected", label: "删除选中", description: "删除当前选中历史" },
  { key: "nextItem", label: "下一项", description: "移动到下一条历史" },
  { key: "previousItem", label: "上一项", description: "移动到上一条历史" }
];

const windowPositionOptions: Array<{ id: WindowPositionMode; label: string }> = [
  { id: "remember", label: "记住位置" },
  { id: "followMouse", label: "跟随鼠标" },
  { id: "screenCenter", label: "屏幕中心" }
];

const searchBoxPositionOptions: Array<{ id: SearchBoxPosition; label: string }> = [
  { id: "top", label: "顶部" },
  { id: "bottom", label: "底部" },
  { id: "hidden", label: "隐藏" }
];

const mousePasteOptions: Array<{ id: MousePasteTrigger; label: string }> = [
  { id: "singleClick", label: "单击" },
  { id: "doubleClick", label: "双击" }
];

const optionalFilterOptions: Array<{ id: OptionalClipFilter; label: string }> = [
  { id: "link", label: "链接" },
  { id: "code", label: "代码" },
  { id: "richText", label: "富文本" },
  { id: "recent", label: "最近使用" },
  { id: "trash", label: "回收站" }
];

export function SettingsContent(props: SettingsContentProps) {
  if (props.activeId === "history") {
    return <HistorySettings {...props} />;
  }
  if (props.activeId === "general") {
    return <GeneralSettings {...props} />;
  }
  if (props.activeId === "hotkeys") {
    return <HotkeySettings {...props} />;
  }
  if (props.activeId === "about") {
    return <AboutSettings />;
  }
  return <ClipboardSettings {...props} />;
}

function ClipboardSettings({ settings, onUpdateSettings }: SettingsContentProps) {
  return (
    <div className="settings-section-grid">
      <SelectRow
        description="打开面板时的位置策略"
        icon={Monitor}
        label="窗口位置"
        options={windowPositionOptions}
        value={settings.windowPosition}
        onChange={(windowPosition) => onUpdateSettings({ windowPosition })}
      />
      <SwitchRow
        checked={settings.copySound}
        description="复制剪切板内容后播放短提示音"
        icon={Volume2}
        label="复制音效"
        onChange={(copySound) => onUpdateSettings({ copySound })}
      />
      <SelectRow
        description="搜索框显示在顶部、底部或隐藏"
        icon={Search}
        label="搜索框位置"
        options={searchBoxPositionOptions}
        value={settings.searchBoxPosition}
        onChange={(searchBoxPosition) => onUpdateSettings({ searchBoxPosition })}
      />
      <OptionalFilterVisibilityRow settings={settings} onUpdateSettings={onUpdateSettings} />
      <SelectRow
        description="鼠标左键触发粘贴的方式"
        icon={MousePointerClick}
        label="自动粘贴"
        options={mousePasteOptions}
        value={settings.mousePasteTrigger}
        onChange={(mousePasteTrigger) => onUpdateSettings({ mousePasteTrigger })}
      />
      <SwitchRow
        checked={settings.deleteConfirmation}
        description="删除剪切板内容前弹出确认对话框"
        icon={Trash2}
        label="删除确认"
        onChange={(deleteConfirmation) => onUpdateSettings({ deleteConfirmation })}
      />
      <SwitchRow
        checked={settings.edgeAutoHide}
        description="靠近屏幕边缘时自动吸附并隐藏"
        icon={MousePointerClick}
        label="边缘自动隐藏"
        onChange={(edgeAutoHide) => onUpdateSettings({ edgeAutoHide })}
      />
    </div>
  );
}

function OptionalFilterVisibilityRow({
  settings,
  onUpdateSettings
}: Pick<SettingsContentProps, "settings" | "onUpdateSettings">) {
  const activeFilters = new Set(settings.optionalFilters ?? []);

  function updateOptionalFilter(id: OptionalClipFilter, enabled: boolean) {
    const optionalFilters = optionalFilterOptions
      .map((option) => option.id)
      .filter((optionId) => (optionId === id ? enabled : activeFilters.has(optionId)));

    void onUpdateSettings({ optionalFilters });
  }

  return (
    <div className="settings-control-row stacked">
      <RowTitle
        description="默认保留全部、文本、收藏、图片、文件；这里控制额外入口"
        icon={Search}
        label="筛选栏显示"
      />
      <div className="settings-segment-grid" role="group" aria-label="筛选栏显示">
        {optionalFilterOptions.map((option) => {
          const active = activeFilters.has(option.id);
          return (
            <button
              key={option.id}
              className={active ? "settings-segment-chip active" : "settings-segment-chip"}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={option.label}
              onClick={() => updateOptionalFilter(option.id, !active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HistorySettings({ clipsCount, onClearHistory, onUpdateSettings, settings }: SettingsContentProps) {
  return (
    <div className="settings-section-grid">
      <NumberRow
        description="输入 0 代表无限条"
        icon={HardDrive}
        label="历史上限"
        value={settings.historyLimit}
        onChange={(historyLimit) => onUpdateSettings({ historyLimit })}
      />
      <NumberRow
        description="默认 30 天，输入 0 为永久保留"
        icon={Clock3}
        label="保留时长"
        value={settings.retentionDays}
        onChange={(retentionDays) => onUpdateSettings({ retentionDays })}
      />
      <NumberRow
        description="默认 7 天，最长 30 天"
        icon={Trash2}
        label="回收站保留"
        min={1}
        max={30}
        value={settings.trashRetentionDays}
        onChange={(trashRetentionDays) => onUpdateSettings({ trashRetentionDays })}
      />
      <InfoRow icon={HardDrive} label="当前记录" value={formatHistoryCount(clipsCount, settings.historyLimit)} />
      <button className="settings-danger-row" disabled={!onClearHistory || clipsCount === 0} type="button" onClick={onClearHistory}>
        <RowTitle description="删除全部历史记录" icon={Trash2} label="清空历史" />
        <span>执行</span>
      </button>
    </div>
  );
}

function GeneralSettings({ settings, onUpdateSettings }: SettingsContentProps) {
  return (
    <div className="settings-section-grid">
      <SwitchRow checked={settings.launchOnStartup} description="登录 Windows 后自动启动 ClipFlow" icon={Power} label="开机自启动" onChange={(launchOnStartup) => onUpdateSettings({ launchOnStartup })} />
      <div className="settings-control-row stacked">
        <RowTitle description="页面与面板的颜色模式" icon={Palette} label="主题模式" />
        <div className="settings-theme-grid" role="radiogroup" aria-label="主题模式">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.id} className={settings.themeMode === option.id ? "settings-theme-chip active" : "settings-theme-chip"} type="button" role="radio" aria-checked={settings.themeMode === option.id} onClick={() => onUpdateSettings({ themeMode: option.id })}>
                <Icon size={16} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="settings-control-row stacked">
        <RowTitle description="选择 ClipFlow 的强调色" icon={Palette} label="预设颜色" />
        <div className="settings-color-grid" role="radiogroup" aria-label="预设颜色">
          {colorOptions.map((option) => (
            <button key={option.id} className={settings.colorPreset === option.id ? "settings-color-chip active" : "settings-color-chip"} type="button" role="radio" aria-checked={settings.colorPreset === option.id} onClick={() => onUpdateSettings({ colorPreset: option.id })}>
              <span style={{ background: option.swatch }} />
              {option.label}
            </button>
          ))}
        </div>
        <CustomColorControl settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    </div>
  );
}

function CustomColorControl({
  settings,
  onUpdateSettings
}: {
  settings: Settings;
  onUpdateSettings: UpdateSettings;
}) {
  const customColor = readCustomColor(settings);
  const [draftColor, setDraftColor] = useState(customColor);

  useEffect(() => {
    setDraftColor(customColor);
  }, [customColor]);

  function updateCustomColor(value: string) {
    const nextColor = normalizeHexColor(value);
    if (!nextColor) {
      return;
    }

    void onUpdateSettings({ colorPreset: "custom", customColor: nextColor });
  }

  return (
    <div className="settings-custom-color-row">
      <button
        className={settings.colorPreset === "custom" ? "settings-color-chip active" : "settings-color-chip"}
        type="button"
        role="radio"
        aria-checked={settings.colorPreset === "custom"}
        onClick={() => onUpdateSettings({ colorPreset: "custom", customColor })}
      >
        <span style={{ background: customColor }} />
        自定义
      </button>
      <label className="settings-color-picker">
        <input
          aria-label="选择自定义颜色"
          name="custom-color-picker"
          type="color"
          value={customColor}
          onChange={(event) => updateCustomColor(event.currentTarget.value)}
        />
        <span style={{ background: customColor }} />
      </label>
      <input
        aria-label="输入自定义颜色"
        className="settings-hex-input"
        name="custom-color"
        value={draftColor}
        spellCheck={false}
        onBlur={() => updateCustomColor(draftColor)}
        onChange={(event) => setDraftColor(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            updateCustomColor(draftColor);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

const themeOptions: Array<{ id: Settings["themeMode"]; label: string; icon: LucideIcon }> = [
  { id: "system", label: "跟随系统", icon: Monitor },
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon }
];

function HotkeySettings({ settings, onUpdateSettings }: SettingsContentProps) {
  const [recordingKey, setRecordingKey] = useState<keyof SettingsShortcuts | null>(null);

  function handleShortcutKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: keyof SettingsShortcuts) {
    if (recordingKey !== key) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setRecordingKey(null);
      event.currentTarget.blur();
      return;
    }

    const shortcut = readShortcutFromEvent(event);
    if (!shortcut) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setRecordingKey(null);
    void onUpdateSettings({ shortcuts: { [key]: shortcut } as Partial<SettingsShortcuts> });
    event.currentTarget.blur();
  }

  return (
    <div className="settings-section-grid">
      {shortcutRows.map((item) => (
        <div className="settings-control-row" key={item.key}>
          <RowTitle description={item.description} icon={shortcutIcon(item.key)} label={item.label} />
          <button
            className={recordingKey === item.key ? "settings-shortcut-recorder recording" : "settings-shortcut-recorder"}
            type="button"
            aria-label={`${item.label}快捷键`}
            aria-pressed={recordingKey === item.key}
            onBlur={() => setRecordingKey((current) => (current === item.key ? null : current))}
            onClick={() => setRecordingKey(item.key)}
            onKeyDown={(event) => handleShortcutKeyDown(event, item.key)}
          >
            <span>{recordingKey === item.key ? "按下新的快捷键" : settings.shortcuts[item.key]}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function readShortcutFromEvent(event: KeyboardEvent<HTMLButtonElement>): string | null {
  const key = formatShortcutKey(event.key);
  if (!key || isModifierOnlyKey(key)) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  if (event.metaKey) {
    parts.push("Meta");
  }
  parts.push(key);
  return parts.join("+");
}

function formatShortcutKey(key: string): string {
  if (key === " ") {
    return "Space";
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

function isModifierOnlyKey(key: string): boolean {
  return ["Alt", "Control", "Meta", "Shift"].includes(key);
}

const openSourceUrl = "https://github.com/BeiChen-CN/ClipFlow";

function AboutSettings() {
  return (
    <div className="settings-section-grid about-section-grid">
      <section className="about-app-card" aria-label="应用信息">
        <img className="about-app-icon" src="/clipflow-icon.png" alt="" />
        <div>
          <span className="settings-kicker">软件介绍</span>
          <h2>ClipFlow</h2>
          <p>
            ClipFlow 是一款面向 Windows 桌面的剪切板管理器, 用来保存、搜索和复用复制过的内容。
            它适合资料整理、写作、办公和开发场景, 让文本、图片、文件、链接与富文本内容更容易找回。
          </p>
        </div>
      </section>

      <InfoRow icon={Clipboard} label="应用名称" value="ClipFlow" />
      <InfoRow icon={Info} label="应用版本" value="0.1.0" />
      <a className="settings-link-row" href={openSourceUrl} target="_blank" rel="noreferrer">
        <RowTitle description={openSourceUrl} icon={ExternalLink} label="开源地址" />
        <span>打开</span>
      </a>
    </div>
  );
}

function formatHistoryCount(count: number, limit: number): string {
  return limit === 0 ? `${count}/无限条` : `${count}/${limit} 条`;
}

function shortcutIcon(key: keyof SettingsShortcuts): LucideIcon {
  if (key === "pasteSelected") {
    return MousePointerClick;
  }
  if (key === "copySelected") {
    return Clipboard;
  }
  if (key === "deleteSelected") {
    return Trash2;
  }
  return Keyboard;
}
