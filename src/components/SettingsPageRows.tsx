import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function SwitchRow({
  checked,
  description,
  icon,
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
    <div className="settings-control-row">
      <RowTitle description={description} icon={icon} label={label} />
      <button
        className={checked ? "settings-switch active" : "settings-switch"}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function SegmentedRow<T extends string>({
  description,
  icon,
  label,
  onChange,
  options,
  value
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  onChange: (value: T) => void | Promise<void>;
  options: Array<{ id: T; label: string }>;
  value: T;
}) {
  return (
    <div className="settings-control-row stacked">
      <RowTitle description={description} icon={icon} label={label} />
      <div className="settings-segment-grid" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            className={value === option.id ? "settings-segment-chip active" : "settings-segment-chip"}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectRow<T extends string>({
  description,
  icon,
  label,
  onChange,
  options,
  value
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  onChange: (value: T) => void | Promise<void>;
  options: Array<{ id: T; label: string }>;
  value: T;
}) {
  const selectId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectOption(nextValue: T) {
    void onChange(nextValue);
    setOpen(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="settings-control-row settings-select-row" ref={rootRef}>
      <RowTitle description={description} icon={icon} label={label} />
      <span className="settings-select-control">
        <button
          aria-controls={`${selectId}-menu`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`${label} ${description}`}
          className={open ? "settings-select-trigger open" : "settings-select-trigger"}
          id={selectId}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span>{selectedOption?.label}</span>
          <ChevronDown size={18} />
        </button>
        {open ? (
          <span className="settings-select-menu" id={`${selectId}-menu`} role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={option.id}
                className={value === option.id ? "settings-select-option active" : "settings-select-option"}
                type="button"
                role="option"
                aria-selected={value === option.id}
                onClick={() => selectOption(option.id)}
              >
                <span>{option.label}</span>
                {value === option.id ? <Check size={16} /> : null}
              </button>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function NumberRow({
  description,
  icon,
  label,
  min = 0,
  max,
  onChange,
  step = 1,
  value
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void | Promise<void>;
  step?: number;
  value: number;
}) {
  const inputId = useId();

  function commit(rawValue: string) {
    const nextValue = Number(rawValue);
    if (Number.isFinite(nextValue)) {
      void onChange(clampNumber(Math.trunc(nextValue), min, max));
    }
  }

  function stepValue(delta: number) {
    void onChange(clampNumber(value + delta, min, max));
  }

  return (
    <div className="settings-control-row settings-number-row">
      <RowTitle description={description} icon={icon} label={label} />
      <span className="settings-number-stepper">
        <button aria-label={`${label}减少`} type="button" onClick={() => stepValue(-step)}>
          <Minus size={16} />
        </button>
        <input
          aria-label={`${label} ${description}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="settings-number-input"
          id={inputId}
          inputMode="numeric"
          role="spinbutton"
          type="text"
          value={value}
          onChange={(event) => commit(event.currentTarget.value)}
        />
        <button aria-label={`${label}增加`} type="button" onClick={() => stepValue(step)}>
          <Plus size={16} />
        </button>
      </span>
    </div>
  );
}

function clampNumber(value: number, min: number, max?: number): number {
  const lowerBound = Math.max(min, value);
  if (typeof max === "number") {
    return Math.min(max, lowerBound);
  }

  return lowerBound;
}

export function InfoRow({
  icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="settings-control-row">
      <RowTitle description="" icon={icon} label={label} />
      <strong className="settings-row-value">{value}</strong>
    </div>
  );
}

export function RowTitle({
  description,
  icon: Icon,
  label
}: {
  description: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="settings-row-title">
      <span className="settings-row-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </span>
  );
}
