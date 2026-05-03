import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Clipboard, Clock3, Info, Keyboard, MonitorCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { magneticSpring, panelMotion, settingsSectionTransition, settingsSectionVariants } from "../domain/motion";
import type { Settings, SettingsPatch } from "../domain/types";
import { SettingsContent } from "./SettingsPageSections";

type SectionId = "clipboard" | "history" | "general" | "hotkeys" | "about";
type UpdateSettings = (patch: SettingsPatch) => void | Promise<void>;
type PageAction = () => void | Promise<void>;

interface SettingsPageProps {
  busyLabel?: string | null;
  clipsCount: number;
  runtimeLabel: string;
  settings: Settings;
  style?: CSSProperties;
  onBack: PageAction;
  onClearHistory?: PageAction;
  onUpdateSettings: UpdateSettings;
}

const sections: Array<{ id: SectionId; label: string; detail: string; icon: LucideIcon }> = [
  { id: "clipboard", label: "剪切板", detail: "默认记录规则", icon: Clipboard },
  { id: "history", label: "历史记录", detail: "容量与保留规则", icon: Clock3 },
  { id: "general", label: "通用", detail: "主题、启动与托盘", icon: MonitorCog },
  { id: "hotkeys", label: "快捷键", detail: "呼出、粘贴与导航", icon: Keyboard },
  { id: "about", label: "关于", detail: "版本与应用信息", icon: Info }
];
const defaultSection = sections[0]!;

export function SettingsPage(props: SettingsPageProps) {
  const [activeId, setActiveId] = useState<SectionId>("clipboard");
  const prefersReducedMotion = useReducedMotion();
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) ?? defaultSection,
    [activeId]
  );
  const ActiveIcon = activeSection.icon;

  return (
    <main
      className="settings-page-shell"
      data-color={props.settings.colorPreset}
      data-theme={props.settings.themeMode}
      style={props.style}
    >
      <motion.div
        className="settings-page"
        initial={prefersReducedMotion ? false : panelMotion.initial}
        animate={prefersReducedMotion ? undefined : panelMotion.animate}
        transition={panelMotion.transition}
      >
        <aside className="settings-sidebar">
          <button className="settings-back-button" type="button" onClick={props.onBack}>
            <ArrowLeft size={17} />
            返回剪切板
          </button>

          <div className="settings-brand-card">
            <span className="settings-brand-icon" aria-hidden="true">
              <MonitorCog size={21} />
            </span>
            <div>
              <strong>ClipFlow 设置</strong>
              <span>{props.busyLabel ?? "本地偏好设置"}</span>
            </div>
          </div>

          <nav className="settings-nav" aria-label="设置分类">
            {sections.map((section) => (
              <NavButton
                key={section.id}
                active={section.id === activeId}
                section={section}
                onClick={() => setActiveId(section.id)}
              />
            ))}
          </nav>
        </aside>

        <section className="settings-workbench" aria-labelledby="settings-page-title">
          <header className="settings-page-header">
            <motion.span
              key={activeId}
              className="settings-section-mark"
              aria-hidden="true"
              initial={prefersReducedMotion ? false : { opacity: 0, rotate: -8, scale: 0.92 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, rotate: 0, scale: 1 }}
              transition={magneticSpring}
            >
              <ActiveIcon size={22} />
            </motion.span>
            <div>
              <span className="settings-kicker">设置 / {activeSection.label}</span>
              <h1 id="settings-page-title">{activeSection.label}</h1>
              <p>{activeSection.detail}</p>
            </div>
          </header>

          <AnimatePresence initial={false}>
            <motion.div
              key={activeId}
              className="settings-section-motion"
              initial={prefersReducedMotion ? false : "initial"}
              animate={prefersReducedMotion ? undefined : "animate"}
              exit={prefersReducedMotion ? undefined : "exit"}
              variants={settingsSectionVariants}
              transition={settingsSectionTransition}
            >
              <SettingsContent activeId={activeId} {...props} />
            </motion.div>
          </AnimatePresence>
        </section>
      </motion.div>
    </main>
  );
}

function NavButton({
  active,
  onClick,
  section
}: {
  active: boolean;
  onClick: () => void;
  section: (typeof sections)[number];
}) {
  const Icon = section.icon;
  return (
    <button className={active ? "settings-nav-item active" : "settings-nav-item"} type="button" onClick={onClick}>
      {active ? <motion.span className="settings-nav-indicator" layoutId="settings-nav-indicator" /> : null}
      <Icon size={18} />
      <span>
        <strong>{section.label}</strong>
        <small>{section.detail}</small>
      </span>
    </button>
  );
}
