import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Clipboard, Clock3, Info, Keyboard, Minus, MonitorCog, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { panelMotion, settingsSectionTransition, settingsSectionVariants } from "../domain/motion";
import type { ClipItem, Settings, SettingsPatch } from "../domain/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { SettingsContent } from "./SettingsPageSections";

type SectionId = "clipboard" | "history" | "trash" | "general" | "hotkeys" | "about";
type UpdateSettings = (patch: SettingsPatch) => void | Promise<void>;
type PageAction = () => void | Promise<void>;
type ClipAction = (id: string) => void | Promise<void>;
type DestructiveConfirmation = {
  message: string;
  resolve: (value: boolean) => void;
};

interface SettingsPageProps {
  busyLabel?: string | null;
  clipsCount: number;
  clips: ClipItem[];
  onCloseWindow?: PageAction;
  onMinimizeWindow?: PageAction;
  onStartWindowDrag?: PageAction;
  runtimeLabel?: string;
  settings: Settings;
  style?: CSSProperties;
  onBack: PageAction;
  onClearHistory?: PageAction;
  onPermanentlyDeleteClip?: ClipAction;
  onRestoreClip?: ClipAction;
  onUpdateSettings: UpdateSettings;
}

const sections: Array<{ id: SectionId; label: string; detail: string; icon: LucideIcon }> = [
  { id: "clipboard", label: "剪切板", detail: "默认记录规则", icon: Clipboard },
  { id: "history", label: "历史记录", detail: "容量与保留规则", icon: Clock3 },
  { id: "trash", label: "回收站", detail: "保留时长与已删除内容", icon: Trash2 },
  { id: "general", label: "通用", detail: "主题、启动与托盘", icon: MonitorCog },
  { id: "hotkeys", label: "快捷键", detail: "呼出、粘贴与导航", icon: Keyboard },
  { id: "about", label: "关于", detail: "版本与应用信息", icon: Info }
];
const defaultSection = sections[0]!;

export function SettingsPage(props: SettingsPageProps) {
  const [activeId, setActiveId] = useState<SectionId>("clipboard");
  const [confirmation, setConfirmation] = useState<DestructiveConfirmation | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) ?? defaultSection,
    [activeId]
  );
  const ActiveIcon = activeSection.icon;

  function requestDestructiveConfirmation(message: string): Promise<boolean> {
    if (!props.settings.deleteConfirmation) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      setConfirmation({ message, resolve });
    });
  }

  function settleDestructiveConfirmation(value: boolean) {
    setConfirmation((current) => {
      current?.resolve(value);
      return null;
    });
  }

  function handleWindowDragPointerDown(event: PointerEvent<HTMLElement>) {
    if (!props.onStartWindowDrag || event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("button, input, textarea, select, a, [data-no-window-drag='true']")) {
      return;
    }

    void props.onStartWindowDrag();
  }

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
          <header className="settings-page-header" onPointerDown={handleWindowDragPointerDown}>
            <motion.span
              key={activeId}
              className="settings-section-mark"
              aria-hidden="true"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={settingsSectionTransition}
            >
              <ActiveIcon size={22} />
            </motion.span>
            <div>
              <span className="settings-kicker">设置 / {activeSection.label}</span>
              <h1 id="settings-page-title">{activeSection.label}</h1>
              <p>{activeSection.detail}</p>
            </div>
            {props.onMinimizeWindow || props.onCloseWindow ? (
              <div className="settings-window-controls" data-no-window-drag="true">
                {props.onMinimizeWindow ? (
                  <button
                    aria-label="最小化窗口"
                    className="settings-window-button"
                    title="最小化窗口"
                    type="button"
                    onClick={() => void props.onMinimizeWindow?.()}
                  >
                    <Minus size={16} />
                  </button>
                ) : null}
                {props.onCloseWindow ? (
                  <button
                    aria-label="关闭设置窗口"
                    className="settings-window-button close"
                    title="关闭设置窗口"
                    type="button"
                    onClick={() => void props.onCloseWindow?.()}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>

          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={activeId}
              className="settings-section-motion"
              initial={prefersReducedMotion ? false : "initial"}
              animate={prefersReducedMotion ? undefined : "animate"}
              exit={prefersReducedMotion ? undefined : "exit"}
              variants={settingsSectionVariants}
              transition={settingsSectionTransition}
            >
              <SettingsContent
                activeId={activeId}
                {...props}
                onConfirmDestructiveAction={requestDestructiveConfirmation}
              />
            </motion.div>
          </AnimatePresence>
        </section>
        <ConfirmDialog
          open={Boolean(confirmation)}
          title="删除回收站内容"
          description={confirmation?.message ?? ""}
          confirmLabel="删除"
          onCancel={() => settleDestructiveConfirmation(false)}
          onConfirm={() => settleDestructiveConfirmation(true)}
        />
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
