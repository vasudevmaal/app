"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

export function CatalogDropdown({ label, value, options, onChange, className = "" }: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = rect.width;
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const upwards = below < 180 && above > below;
    const maxHeight = Math.max(40, Math.min(280, upwards ? above : below));
    const height = Math.min(options.length * 36 + 8, maxHeight);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: upwards ? rect.top - height - 6 : rect.bottom + 6,
      width,
      maxHeight,
    });
    menu.current?.focus({ preventScroll: true });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const moved = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", moved);
    window.addEventListener("scroll", moved, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", moved);
      window.removeEventListener("scroll", moved, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  return <>
    <button ref={trigger} type="button" className={`catalog-dropdown-trigger ${className}`}
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { setActive(selected); setOpen(!open); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setActive(selected); setOpen(true);
        }
      }}>
      <span className="catalog-dropdown-value">{options[selected]?.label}</span>
      <span className="catalog-dropdown-measure" aria-hidden="true">
        {options.map((option) => <span key={option.value}>{option.label}</span>)}
      </span>
      <ChevronDown size={12} />
    </button>
    {open && createPortal(
      <div ref={menu} id={id} role="listbox" tabIndex={-1} aria-label={label}
        aria-activedescendant={`${id}-${active}`} className="catalog-dropdown-menu" style={position}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setActive((index) => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault(); choose(active);
          } else if (event.key === "Escape" || event.key === "Tab") {
            event.preventDefault(); setOpen(false); trigger.current?.focus();
          } else if (event.key.length === 1) {
            const index = options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
            if (index >= 0) setActive(index);
          }
        }}>
        {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option"
          aria-selected={option.value === value} className="catalog-dropdown-option" data-active={index === active}
          onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
          <span>{option.label}</span>{option.value === value && <Check size={14} />}
        </div>)}
      </div>, document.body,
    )}
  </>;
}
