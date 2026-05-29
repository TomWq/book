"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type SelectOption<Value extends string> = {
  value: Value;
  label: string;
  hint?: string;
};

export function CustomSelect<Value extends string>({
  id,
  label,
  value,
  options,
  openSelect,
  setOpenSelect,
  onChange,
  className = ""
}: {
  id: string;
  label?: string;
  value: Value;
  options: Array<SelectOption<Value>>;
  openSelect: string | null;
  setOpenSelect: (value: string | null) => void;
  onChange: (value: Value) => void;
  className?: string;
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openSelect === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const [menuMaxHeight, setMenuMaxHeight] = useState(280);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePlacement() {
      const rect = rootRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const viewportPadding = 16;
      const gap = 8;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const estimatedHeight = Math.min(280, Math.max(150, options.length * 54 + 12));
      const openUp = availableBelow < Math.min(estimatedHeight, 220) && availableAbove > availableBelow;
      const availableSpace = openUp ? availableAbove : availableBelow;

      setPlacement(openUp ? "up" : "down");
      setMenuMaxHeight(Math.max(132, Math.min(280, availableSpace - gap)));
    }

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, options.length]);

  return (
    <div
      ref={rootRef}
      className={`custom-select custom-select-${placement} ${className}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;

        if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
          setOpenSelect(null);
        }
      }}
    >
      {label ? <span className="custom-select-label">{label}</span> : null}
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenSelect(isOpen ? null : id)}
      >
        <span>{current?.label ?? "请选择"}</span>
        <span className="custom-select-caret" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="custom-select-menu" role="listbox" style={{ maxHeight: menuMaxHeight }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`custom-select-option ${option.value === value ? "selected" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpenSelect(null);
              }}
            >
              <span>{option.label}</span>
              {option.hint ? <small>{option.hint}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
