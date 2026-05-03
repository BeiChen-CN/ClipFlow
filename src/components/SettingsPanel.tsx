import { Clock3, HardDrive, Moon, Monitor, Palette, Power, Settings2, Sun, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import type { ColorPreset, Settings, SettingsPatch } from "../domain/types";
import { IconButton } from "./SearchPanelParts";

type UpdateSettings = (patch: SettingsPatch) => void | Promise<void>;

const themeOptions: Array<{ id: Settings["themeMode"]; label: string; icon: LucideIcon }> = [
  { id: "system", label: "跟随系统", icon: Monitor },
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon }
];

const colorOptions: Array<{ id: ColorPreset; label: string }> = [
  { id: "teal", label: "青绿" },
  { id: "blue", label: "蓝色" },
  { id: "indigo", label: "靛蓝" },
  { id: "violet", label: "紫色" },
  { id: "rose", label: "玫红" },
  { id: "coral", label: "珊瑚" },
  { id: "amber", label: "琥珀" },
  { id: "slate", label: "石墨" }
];

export function SettingsPanel({
  busyLabel,
  onClose,
  onUpdateSettings,
  settings
}: {
  busyLabel: string | null;
  onClose: () => void;
  onUpdateSettings: UpdateSettings;
  settings: Settings;
}) {
  function handleKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="settings-layer" role="dialog" aria-label="ClipFlow 设置" onKeyDown={handleKeyDown}>
      <div className="settings-panel">
        <header className="settings-header">
          <div className="settings-title">
            <span className="brand-mark" aria-hidden="true">
              <Settings2 size={18} />
            </span>
            <div>
              <h2>设置</h2>
              <span>{busyLabel ?? "本地偏好"}</span>
            </div>
          </div>
          <IconButton label="关闭设置" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>

        <div className="settings-content">
          <ToggleRow
            checked={settings.launchOnStartup}
            description="登录 Windows 后启动 ClipFlow"
            icon={Power}
            label="开机自启动"
            onChange={(launchOnStartup) => onUpdateSettings({ launchOnStartup })}
          />
          <NumberRow
            description="输入 0 代表无限条"
            icon={HardDrive}
            id="history-limit"
            label="历史上限"
            value={settings.historyLimit}
            onChange={(historyLimit) => onUpdateSettings({ historyLimit })}
          />
          <NumberRow
            description="输入 0 为永久保留"
            icon={Clock3}
            id="retention-days"
            label="保留时长"
            value={settings.retentionDays}
            onChange={(retentionDays) => onUpdateSettings({ retentionDays })}
          />
          <ThemeRow settings={settings} onUpdateSettings={onUpdateSettings} />
          <ColorRow settings={settings} onUpdateSettings={onUpdateSettings} />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  icon: Icon,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void | Promise<void>;
}) {
  return (
    <div className="settings-row">
      <RowText description={description} icon={Icon} label={label} />
      <button className={checked ? "switch-control active" : "switch-control"} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

function NumberRow({
  description,
  icon,
  id,
  label,
  onChange,
  value
}: {
  description: string;
  icon: LucideIcon;
  id: string;
  label: string;
  onChange: (value: number) => void | Promise<void>;
  value: number;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Math.max(0, Math.trunc(Number(event.currentTarget.value))));
  }

  return (
    <label className="settings-row" htmlFor={id}>
      <RowText description={description} icon={icon} label={label} />
      <input id={id} className="number-input" inputMode="numeric" min={0} type="number" value={value} onChange={handleChange} />
    </label>
  );
}

function ThemeRow({ settings, onUpdateSettings }: RowProps) {
  return (
    <div className="settings-row stacked">
      <RowText description="页面与面板颜色模式" icon={Palette} label="主题模式" />
      <div className="theme-segments" role="radiogroup" aria-label="主题模式">
        {themeOptions.map((option) => (
          <Segment key={option.id} active={settings.themeMode === option.id} icon={option.icon} label={option.label} onClick={() => onUpdateSettings({ themeMode: option.id })} />
        ))}
      </div>
    </div>
  );
}

function ColorRow({ settings, onUpdateSettings }: RowProps) {
  return (
    <div className="settings-row stacked">
      <RowText description="选择 ClipFlow 强调色" icon={Palette} label="预设颜色" />
      <div className="theme-segments" role="radiogroup" aria-label="预设颜色">
        {colorOptions.map((option) => (
          <Segment key={option.id} active={settings.colorPreset === option.id} label={option.label} onClick={() => onUpdateSettings({ colorPreset: option.id })} />
        ))}
      </div>
    </div>
  );
}

function Segment({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon?: LucideIcon;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button className={active ? "theme-segment active" : "theme-segment"} type="button" role="radio" aria-checked={active} onClick={() => onClick()}>
      {Icon ? <Icon aria-hidden="true" size={15} /> : null}
      {label}
    </button>
  );
}

function RowText({
  description,
  icon: Icon,
  label
}: {
  description: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span>
      <Icon aria-hidden="true" size={16} />
      <strong>{label}</strong>
      <small>{description}</small>
    </span>
  );
}

interface RowProps {
  onUpdateSettings: UpdateSettings;
  settings: Settings;
}
