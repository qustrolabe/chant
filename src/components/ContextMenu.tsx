import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type ContextMenuItem =
  | { label: string; action: () => void; disabled?: boolean }
  | { type: "separator" };

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

export function ContextMenu({ x, y, onClose, items }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    // Flip if near edges
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y;
      setPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed min-w-[160px] bg-bg-surface border border-border-strong rounded-lg shadow-2xl py-1 z-[100]"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if ("type" in item && item.type === "separator") {
          return (
            <div key={`sep-${i}`} className="my-1 border-t border-border" />
          );
        }
        const menuItem = item as Exclude<ContextMenuItem, { type: "separator" }>;
        return (
          <button
            key={menuItem.label}
            disabled={menuItem.disabled}
            className="w-full text-left px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => {
              menuItem.action();
              onClose();
            }}
          >
            {menuItem.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

interface ContextMenuState<T> {
  visible: boolean;
  x: number;
  y: number;
  data: T | null;
}

export function useContextMenu<T = unknown>() {
  const [state, setState] = useState<ContextMenuState<T>>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const open = useCallback((e: React.MouseEvent, data: T) => {
    setState({ visible: true, x: e.clientX, y: e.clientY, data });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return { state, open, close };
}
