import { useState } from "react";
import {
  Bell,
  Clipboard,
  Clock3,
  Gauge,
  HardDrive,
  Info,
  Keyboard,
  Layers3,
  MonitorCog,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Trash2
} from "lucide-react";
import "../styles/concepts.css";

type ConceptId = "A" | "B" | "C";

const sections = [
  { label: "剪切板", icon: Clipboard, value: "默认记录 · 去重" },
  { label: "历史记录", icon: Clock3, value: "容量 · 保留 · 清理" },
  { label: "通用", icon: MonitorCog, value: "启动 · 主题 · 托盘行为" },
  { label: "快捷键", icon: Keyboard, value: "呼出 · 粘贴 · 导航" },
  { label: "关于", icon: Info, value: "版本 · 应用信息" }
] as const;

const rows = [
  { label: "保留时长", value: "30 天", icon: Clock3 },
  { label: "历史上限", value: "100 条", icon: HardDrive },
  { label: "预设颜色", value: "青绿", icon: Palette },
  { label: "呼出面板", value: "Alt+C", icon: Keyboard }
] as const;

export function SettingsConcepts() {
  const [selected, setSelected] = useState<ConceptId>("B");

  return (
    <main className="concept-page">
      <header className="concept-hero">
        <div>
          <p>ClipFlow 设置页设计提案</p>
          <h1>选择一个设置页方向</h1>
        </div>
        <div className="choice-bar" aria-label="当前选择">
          {(["A", "B", "C"] as const).map((id) => (
            <button
              key={id}
              className={selected === id ? "choice active" : "choice"}
              type="button"
              onClick={() => setSelected(id)}
            >
              方案 {id}
            </button>
          ))}
        </div>
      </header>

      <section className="concept-grid" aria-label="设置页方案">
        <ConceptShell
          active={selected === "A"}
          badge="方案 A"
          title="Desktop Sidebar"
          summary="标准设置页，左侧导航，右侧编辑。适合后续设置项继续增长。"
          onSelect={() => setSelected("A")}
        >
          <SidebarConcept />
        </ConceptShell>

        <ConceptShell
          active={selected === "B"}
          badge="方案 B"
          title="Expressive Hub"
          summary="最 M3E，大分区卡片清晰，适合强调五个设置大项。"
          onSelect={() => setSelected("B")}
        >
          <HubConcept />
        </ConceptShell>

        <ConceptShell
          active={selected === "C"}
          badge="方案 C"
          title="Compact Control"
          summary="更像桌面工具控制台，信息密度高，适合小窗口快速配置。"
          onSelect={() => setSelected("C")}
        >
          <CompactConcept />
        </ConceptShell>
      </section>
    </main>
  );
}

function ConceptShell({
  active,
  badge,
  children,
  onSelect,
  summary,
  title
}: {
  active: boolean;
  badge: string;
  children: React.ReactNode;
  onSelect: () => void;
  summary: string;
  title: string;
}) {
  return (
    <article className={active ? "concept-card active" : "concept-card"}>
      <div className="concept-card-head">
        <span>{badge}</span>
        <button type="button" onClick={onSelect}>{active ? "已选中" : "选择"}</button>
      </div>
      <h2>{title}</h2>
      <p>{summary}</p>
      {children}
    </article>
  );
}

function SidebarConcept() {
  return (
    <div className="mock mock-sidebar">
      <nav aria-label="方案 A 设置导航">
        {sections.map((item, index) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className={index === 0 ? "active" : ""} type="button">
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mock-content">
        <MockTitle icon={Clipboard} title="剪切板" subtitle="默认记录规则" />
        {rows.map((row) => <SettingRow key={row.label} {...row} />)}
      </div>
    </div>
  );
}

function HubConcept() {
  return (
    <div className="mock mock-hub">
      <div className="hub-top">
        <MockTitle icon={Sparkles} title="设置中心" subtitle="五个大项集中管理" />
        <span>Alt+C</span>
      </div>
      <div className="hub-cards">
        {sections.map((item, index) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className={index === 0 ? "hub-card active" : "hub-card"} type="button">
              <Icon size={18} />
              <strong>{item.label}</strong>
              <small>{item.value}</small>
            </button>
          );
        })}
      </div>
      <div className="hub-detail">
        <SettingRow icon={Clock3} label="保留时长" value="30 天" />
        <SettingRow icon={Trash2} label="清空历史" value="手动执行" />
      </div>
    </div>
  );
}

function CompactConcept() {
  return (
    <div className="mock mock-compact">
      <div className="compact-tabs" aria-label="方案 C 设置导航">
        {sections.map((item, index) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className={index === 0 ? "active" : ""} type="button" title={item.label}>
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div className="compact-main">
        <MockTitle icon={SlidersHorizontal} title="剪切板" subtitle="快速配置" />
        <div className="compact-metrics">
          <Metric icon={Gauge} label="容量" value="100" />
          <Metric icon={Bell} label="通知" value="静默" />
          <Metric icon={Clock3} label="保留" value="30天" />
        </div>
        {rows.slice(0, 3).map((row) => <SettingRow key={row.label} {...row} />)}
      </div>
    </div>
  );
}

function MockTitle({
  icon: Icon,
  subtitle,
  title
}: {
  icon: typeof Clipboard;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="mock-title">
      <span><Icon size={18} /></span>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Clipboard;
  label: string;
  value: string;
}) {
  return (
    <div className="setting-row-mini">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <Icon size={15} />
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
