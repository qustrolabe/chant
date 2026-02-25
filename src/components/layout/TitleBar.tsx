import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { LuPanelLeft, LuBot } from "react-icons/lu";
import { MenuBar } from "./MenuBar";

export function AppTitleBar({
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
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    const sync = async () => setMaximized(await win.isMaximized());
    void sync();
    const unlisten = win.listen("tauri://resize", () => void sync());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 select-none items-center border-b border-border bg-bg-surface"
    >
      {/* Brand */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-4"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(217,159,80,0.4)]" />
        <span className="text-xs font-semibold tracking-wide text-fg-secondary">
          Chant
        </span>
      </div>

      {/* Menu bar */}
      <div data-tauri-drag-region="false">
        <MenuBar
          leftVisible={leftVisible}
          rightVisible={rightVisible}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
          onOpenCommandPalette={onOpenCommandPalette}
        />
      </div>

      {/* Toggles */}
      <div
        className="flex items-center gap-1 pl-2"
        data-tauri-drag-region="false"
      >
        <button
          onClick={onToggleLeft}
          title="Toggle navigation"
          className={`rounded p-1 text-sm transition-colors ${
            leftVisible
              ? "bg-bg-overlay text-fg-secondary"
              : "text-fg-muted hover:text-fg-secondary"
          }`}
        >
          <LuPanelLeft />
        </button>
        <button
          onClick={onToggleRight}
          title="Toggle agent"
          className={`rounded p-1 text-sm transition-colors ${
            rightVisible
              ? "bg-bg-overlay text-fg-secondary"
              : "text-fg-muted hover:text-fg-secondary"
          }`}
        >
          <LuBot />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Window controls */}
      <div className="flex h-full" data-tauri-drag-region="false">
        <button
          className="inline-flex w-12 cursor-default items-center justify-center text-fg-muted transition-colors hover:bg-bg-overlay"
          onClick={() => getCurrentWindow().minimize()}
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <path d="M0 0h10v1H0z" fill="currentColor" />
          </svg>
        </button>
        <button
          className="inline-flex w-12 cursor-default items-center justify-center text-fg-muted transition-colors hover:bg-bg-overlay"
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          {maximized
            ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M2 0h8v8h-2v2H0V2h2V0zm1 1v1h5v5h1V1H3zM1 3v6h6V3H1z"
                  fill="currentColor"
                />
              </svg>
            )
            : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M1 1h8v8H1z"
                  fill="none"
                  stroke="currentColor"
                />
              </svg>
            )}
        </button>
        <button
          className="inline-flex w-12 cursor-default items-center justify-center text-fg-muted transition-colors hover:bg-danger hover:text-fg-primary"
          onClick={() => getCurrentWindow().close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 1l8 8M1 9l8-8"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
