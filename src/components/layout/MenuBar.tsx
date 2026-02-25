import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";

type MenuItem =
  | { label: string; action: () => void; shortcut?: string; disabled?: boolean }
  | { type: "separator" };

interface MenuDef {
  label: string;
  items: MenuItem[];
}

export function MenuBar({
  leftVisible,
  rightVisible,
  onToggleLeft,
  onToggleRight,
  onOpenCommandPalette,
}: {
  leftVisible: boolean;
  rightVisible: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onOpenCommandPalette: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "Settings", action: () => navigate({ to: "/settings" }) },
        { type: "separator" },
        { label: "Exit", action: () => getCurrentWindow().close() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Select All", action: () => {}, disabled: true, shortcut: "Ctrl+A" },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: `${leftVisible ? "Hide" : "Show"} Sidebar`,
          action: onToggleLeft,
        },
        {
          label: `${rightVisible ? "Hide" : "Show"} Agent`,
          action: onToggleRight,
        },
        { type: "separator" },
        {
          label: "Command Palette",
          action: onOpenCommandPalette,
          shortcut: "Ctrl+K",
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "About Chant", action: () => navigate({ to: "/settings" }) },
        {
          label: "GitHub",
          action: () => window.open("https://github.com", "_blank"),
        },
      ],
    },
  ];

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    },
    [],
  );

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpenMenu(null);
  }, []);

  useEffect(() => {
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [openMenu, handleClickOutside, handleEscape]);

  return (
    <div ref={barRef} className="flex items-center h-full">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              openMenu === menu.label
                ? "bg-bg-overlay text-fg-primary"
                : "text-fg-muted hover:text-fg-secondary hover:bg-bg-overlay/50"
            }`}
            onClick={() =>
              setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => {
              if (openMenu && openMenu !== menu.label) {
                setOpenMenu(menu.label);
              }
            }}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div className="absolute left-0 top-full mt-px min-w-[180px] bg-bg-surface border border-border-strong rounded-lg shadow-2xl py-1 z-50">
              {menu.items.map((item, i) => {
                if ("type" in item && item.type === "separator") {
                  return (
                    <div
                      key={`sep-${i}`}
                      className="my-1 border-t border-border"
                    />
                  );
                }
                const menuItem = item as Exclude<MenuItem, { type: "separator" }>;
                return (
                  <button
                    key={menuItem.label}
                    disabled={menuItem.disabled}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    onClick={() => {
                      menuItem.action();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{menuItem.label}</span>
                    {menuItem.shortcut && (
                      <span className="text-fg-muted text-[10px] ml-4">
                        {menuItem.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
